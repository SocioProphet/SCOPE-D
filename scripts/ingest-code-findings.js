#!/usr/bin/env node
'use strict';

/**
 * Ingest claude-code-security-review findings into the SCOPE-D intelligence pipeline.
 *
 * Input:  findings.json (or claudecode-results.json) from the GitHub Action.
 * Output: IntelligenceEnrichment-shaped JSON suitable for feeding export-detection-candidates.js.
 *
 * Schema note: the intelligence-enrichment schema's sourceSet enum does not yet include
 * "code_scan". Output is validated against a relaxed subset — add "code_scan" to the enum
 * and "code_vulnerability" to the observation category enum when productionising this path.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { applyHardExclusions } = require('./hard-exclusion-rules');

const CONFIDENCE_FLOOR = 0.7;

function usage() {
  console.log('Usage: node scripts/ingest-code-findings.js <findings.json> [--out <enrichment.json>]');
  console.log('       Reads cc-security-review findings.json, emits SCOPE-D IntelligenceEnrichment JSON.');
}

function parseArgs(argv) {
  const args = { input: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--help' || argv[i] === '-h') { usage(); process.exit(0); }
    if (argv[i] === '--out') { args.out = argv[++i]; continue; }
    if (!args.input) { args.input = argv[i]; continue; }
    throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.input) throw new Error('Missing findings.json path.');
  return args;
}

function sha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'finding';
}

/** Map cc-security-review severity → SCOPE-D severity enum. */
function mapSeverity(severity) {
  const s = (severity || '').toUpperCase();
  if (s === 'HIGH' || s === 'CRITICAL') return 'high';
  if (s === 'MEDIUM') return 'medium';
  return 'low';
}

/**
 * Map cc-security-review category → SCOPE-D observation category.
 * The code_vulnerability category is not yet in the schema; falls back to exposure_context.
 */
function mapCategory(category) {
  const c = (category || '').toLowerCase();
  if (c.includes('dependency') || c.includes('package') || c.includes('supply_chain')) return 'package_vulnerability';
  if (c.includes('cve') || c.includes('known_exploit')) return 'known_exploited_vulnerability';
  return 'exposure_context';
}

/** Map cc-security-review category → ATT&CK technique for graph edge. */
function mapAttack(category) {
  const c = (category || '').toLowerCase();
  if (c.includes('sql')) return 'ATT&CK:T1190';
  if (c.includes('command') || c.includes('rce') || c.includes('code_execution')) return 'ATT&CK:T1059';
  if (c.includes('auth') || c.includes('bypass')) return 'ATT&CK:T1078';
  if (c.includes('xss')) return 'ATT&CK:T1059';
  if (c.includes('secret') || c.includes('credential') || c.includes('hardcoded')) return 'ATT&CK:T1552';
  if (c.includes('injection')) return 'ATT&CK:T1190';
  if (c.includes('dependency') || c.includes('supply')) return 'ATT&CK:T1195';
  return 'ATT&CK:T1190';
}

function buildEnrichment(rawFindings, inputPath) {
  // Apply hard exclusion FP filter before anything else
  const { kept, excluded } = applyHardExclusions(rawFindings);
  if (excluded.length > 0) {
    console.error(`[hard-exclusions] Filtered ${excluded.length} low-signal finding(s):`);
    for (const { finding, reason } of excluded) {
      console.error(`  - ${finding.file || '?'}:${finding.line || '?'} — ${reason}`);
    }
  }

  // Apply confidence floor
  const eligible = kept.filter((f) => (f.confidence || 0) >= CONFIDENCE_FLOOR);
  const belowFloor = kept.length - eligible.length;
  if (belowFloor > 0) {
    console.error(`[confidence-floor] Dropped ${belowFloor} finding(s) below ${CONFIDENCE_FLOOR} confidence threshold.`);
  }

  if (eligible.length === 0) {
    throw new Error('No findings survived hard exclusion and confidence floor filtering.');
  }

  const now = new Date().toISOString();
  const enrichmentSlug = slug(path.basename(inputPath, '.json'));
  const enrichmentId = `intelligence-enrichment:code-scan-${enrichmentSlug}`;

  const indicators = [];
  const receipts = [];
  const observations = [];
  const graphEdges = [];

  for (let i = 0; i < eligible.length; i++) {
    const finding = eligible[i];
    const findingKey = `${finding.file || 'unknown'}:${finding.line || 0}:${finding.category || 'unknown'}`;
    const base = slug(findingKey);
    const idx = String(i).padStart(3, '0');

    const indicatorId = `indicator:code-${base}-${idx}`;
    const receiptId = `intelligence-receipt:code-scan-${base}-${idx}`;
    const observationId = `intelligence-observation:code-${base}-${idx}`;
    const edgeId = `cyber-graph-edge:code-obs-${base}-${idx}`;

    // Indicator: the source file as a repository asset
    indicators.push({
      indicatorId,
      kind: 'repository',
      value: `${finding.file || 'unknown'}:${finding.line || 0}`,
      assetRefs: [`repo://${finding.file || 'unknown'}`],
      redactionState: 'cleartext',
    });

    // Receipt: synthetic code-scan receipt (fixture mode)
    receipts.push({
      receiptId,
      provider: 'claude-code-security-review',
      indicatorRef: indicatorId,
      queryClass: 'artifact_reputation',
      queriedAt: now,
      mode: 'fixture',
      termsClass: 'internal_fixture',
      cacheKey: sha256(findingKey).slice(0, 32),
      evidenceHash: sha256(JSON.stringify(finding)),
      liveConnectionUsed: false,
      executionPerformed: false,
    });

    // Observation: the finding mapped to intelligence observation shape
    observations.push({
      observationId,
      indicatorRef: indicatorId,
      provider: 'claude-code-security-review',
      category: mapCategory(finding.category),
      confidence: finding.confidence,
      severity: mapSeverity(finding.severity),
      summary: `[${finding.severity || 'UNKNOWN'}] ${finding.category || 'unknown'} at ${finding.file || '?'}:${finding.line || '?'} — ${finding.description || ''}`,
      evidenceRefs: [receiptId],
      // Extended fields not in current schema — preserved for downstream enrichment
      _exploitScenario: finding.exploit_scenario || '',
      _recommendation: finding.recommendation || '',
      _attackTechnique: mapAttack(finding.category),
    });

    // Graph edge: observation → should_generate_detection
    graphEdges.push({
      edgeId,
      from: observationId,
      predicate: 'should_generate_detection',
      to: `attack-technique:${mapAttack(finding.category)}`,
      sourceRefs: [receiptId],
      confidence: finding.confidence,
    });
  }

  return {
    schemaVersion: '0.1.0',
    enrichmentId,
    generatedAt: now,
    mode: 'fixture',
    // Note: "code_scan" is not yet in the sourceSet enum — add when productionising
    sourceSet: ['github_advisory'],
    indicators,
    receipts,
    observations,
    graphEdges,
    executionPerformed: false,
    _meta: {
      source: 'claude-code-security-review',
      inputFile: inputPath,
      totalRawFindings: rawFindings.length,
      hardExcluded: excluded.length,
      belowFloorDropped: belowFloor,
      ingested: eligible.length,
    },
  };
}

function main() {
  const args = parseArgs(process.argv);
  const raw = JSON.parse(fs.readFileSync(path.resolve(args.input), 'utf8'));

  // Accept both findings.json (array) and claudecode-results.json ({findings: []})
  const rawFindings = Array.isArray(raw) ? raw : (raw.findings || []);
  if (rawFindings.length === 0) throw new Error('No findings found in input file.');

  const enrichment = buildEnrichment(rawFindings, args.input);

  const out = JSON.stringify(enrichment, null, 2) + '\n';
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(path.resolve(args.out), out, 'utf8');
    console.error(`[ingest-code-findings] Wrote ${enrichment._meta.ingested} observation(s) to ${args.out}`);
  } else {
    process.stdout.write(out);
  }
}

try { main(); } catch (err) { console.error(`ingest-code-findings failed: ${err.message}`); process.exit(1); }
