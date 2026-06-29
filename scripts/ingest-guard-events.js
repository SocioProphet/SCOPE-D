#!/usr/bin/env node
'use strict';

/**
 * Ingest Noetica security guard-fire events into the SCOPE-D intelligence pipeline.
 *
 * Input:  Newline-delimited JSON (NDJSON) file of guard events.
 * Output: IntelligenceEnrichment-shaped JSON (observations, receipts, graphEdges).
 *
 * Supported guard types:
 *   memory_poison  — category: exposure_context, severity: medium
 *   ipi_strip      — category: internet_noise,   severity: low
 *
 * CLI: node scripts/ingest-guard-events.js <events.ndjson> [--out enrichment.json]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function usage() {
  console.log('Usage: node scripts/ingest-guard-events.js <events.ndjson> [--out <enrichment.json>]');
  console.log('       Reads Noetica guard-fire NDJSON, emits SCOPE-D IntelligenceEnrichment JSON.');
}

function parseArgs(argv) {
  const args = { input: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--help' || argv[i] === '-h') { usage(); process.exit(0); }
    if (argv[i] === '--out') { args.out = argv[++i]; continue; }
    if (!args.input) { args.input = argv[i]; continue; }
    throw new Error('Unknown argument: ' + argv[i]);
  }
  if (!args.input) throw new Error('Missing events.ndjson path.');
  return args;
}

function sha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'guard-event';
}

/**
 * Parse NDJSON — skip blank lines and lines that fail to parse (with a warning).
 * @param {string} text
 * @returns {Array<object>}
 */
function parseNDJSON(text) {
  const events = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      events.push(JSON.parse(line));
    } catch (err) {
      console.error('[ingest-guard-events] Skipping malformed NDJSON line ' + (i + 1) + ': ' + err.message);
    }
  }
  return events;
}

/**
 * Map guardType → SCOPE-D observation category.
 */
function mapCategory(guardType) {
  if (guardType === 'memory_poison') return 'exposure_context';
  if (guardType === 'ipi_strip') return 'internet_noise';
  return 'exposure_context';
}

/**
 * Map guardType → SCOPE-D severity.
 */
function mapSeverity(guardType) {
  if (guardType === 'memory_poison') return 'medium';
  return 'low';
}

/**
 * Map guardType → ATT&CK technique reference.
 * memory_poison → T1059.004 (Unix Shell injection / memory manipulation)
 * ipi_strip     → T1059    (Command and Scripting Interpreter — prompt injection)
 */
function mapAttack(guardType) {
  if (guardType === 'memory_poison') return 'attack-technique:ATT&CK:T1059.004';
  return 'attack-technique:ATT&CK:T1059';
}

/**
 * Default confidence for guard types that don't carry an explicit confidence field.
 */
const DEFAULT_CONFIDENCE = 0.75;

function buildEnrichment(events, inputPath) {
  if (events.length === 0) throw new Error('No guard events found in input file.');

  const now = new Date().toISOString();
  const enrichmentSlug = slug(path.basename(inputPath, path.extname(inputPath)));
  const enrichmentId = 'intelligence-enrichment:guard-events-' + enrichmentSlug;

  const indicators = [];
  const receipts = [];
  const observations = [];
  const graphEdges = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const guardType = event.guardType || 'unknown';
    const confidence = typeof event.confidence === 'number' ? event.confidence : DEFAULT_CONFIDENCE;
    const source = event.source || 'unknown';
    const contentHash = event.content_hash || sha256(JSON.stringify(event));

    const idx = String(i).padStart(3, '0');
    const base = slug(guardType + '-' + source + '-' + idx);

    const indicatorId = 'indicator:guard-' + base;
    const receiptId = 'intelligence-receipt:guard-' + base;
    const observationId = 'intelligence-observation:guard-' + base;
    const edgeId = 'cyber-graph-edge:guard-obs-' + base;

    // Build a human-readable summary
    let summary = '[' + guardType.toUpperCase() + '] guard fired from source:' + source;
    if (guardType === 'memory_poison' && Array.isArray(event.patterns) && event.patterns.length > 0) {
      summary += ' — patterns: ' + event.patterns.join(', ');
    }
    if (guardType === 'ipi_strip' && Array.isArray(event.stripped) && event.stripped.length > 0) {
      summary += ' — stripped: "' + event.stripped.slice(0, 2).join('", "') + '"';
    }
    if (guardType === 'ipi_strip' && event.url) {
      summary += ' (url: ' + event.url + ')';
    }

    indicators.push({
      indicatorId,
      kind: 'repository',
      value: 'noetica-guard:' + guardType + ':' + source,
      assetRefs: ['guard://' + guardType + '/' + source],
      redactionState: 'cleartext',
    });

    receipts.push({
      receiptId,
      provider: 'noetica-security-guard',
      indicatorRef: indicatorId,
      queryClass: 'artifact_reputation',
      queriedAt: event.timestamp || now,
      mode: 'fixture',
      termsClass: 'internal_fixture',
      cacheKey: sha256(guardType + ':' + source + ':' + idx).slice(0, 32),
      evidenceHash: sha256(contentHash),
      liveConnectionUsed: false,
      executionPerformed: false,
    });

    observations.push({
      observationId,
      indicatorRef: indicatorId,
      provider: 'noetica-security-guard',
      category: mapCategory(guardType),
      confidence,
      severity: mapSeverity(guardType),
      summary,
      evidenceRefs: [receiptId],
      _guardType: guardType,
      _source: source,
      _attackTechnique: mapAttack(guardType).replace('attack-technique:', ''),
    });

    graphEdges.push({
      edgeId,
      from: observationId,
      predicate: 'should_generate_detection',
      to: mapAttack(guardType),
      sourceRefs: [receiptId],
      confidence,
    });
  }

  return {
    schemaVersion: '0.1.0',
    enrichmentId,
    generatedAt: now,
    mode: 'fixture',
    sourceSet: ['github_advisory'],
    indicators,
    receipts,
    observations,
    graphEdges,
    executionPerformed: false,
    _meta: {
      source: 'noetica-security-guard',
      inputFile: inputPath,
      totalEvents: events.length,
      ingested: events.length,
    },
  };
}

function main() {
  const args = parseArgs(process.argv);
  const text = fs.readFileSync(path.resolve(args.input), 'utf8');
  const events = parseNDJSON(text);

  const enrichment = buildEnrichment(events, args.input);

  const out = JSON.stringify(enrichment, null, 2) + '\n';
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(path.resolve(args.out), out, 'utf8');
    console.error('[ingest-guard-events] Wrote ' + enrichment._meta.ingested + ' observation(s) to ' + args.out);
  } else {
    process.stdout.write(out);
  }
}

try { main(); } catch (err) { console.error('ingest-guard-events failed: ' + err.message); process.exit(1); }
