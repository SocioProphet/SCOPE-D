#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const ENRICHMENT_SCHEMA = 'config/schemas/intelligence-enrichment.schema.json';

const PROVIDERS = {
  virustotal: { queryClass: 'artifact_reputation', termsClass: 'commercial_api' },
  greynoise: { queryClass: 'internet_noise', termsClass: 'commercial_api' },
  urlscan: { queryClass: 'url_analysis', termsClass: 'public_api' },
  cisa_kev: { queryClass: 'vulnerability_priority', termsClass: 'public_api' },
  epss: { queryClass: 'vulnerability_priority', termsClass: 'public_api' },
  nvd: { queryClass: 'vulnerability_priority', termsClass: 'public_api' },
  osv: { queryClass: 'package_vulnerability', termsClass: 'public_api' },
  github_advisory: { queryClass: 'package_vulnerability', termsClass: 'public_api' },
  mandiant: { queryClass: 'adversary_context', termsClass: 'restricted_partner' },
  recorded_future: { queryClass: 'adversary_context', termsClass: 'restricted_partner' },
  shodan: { queryClass: 'attack_surface_context', termsClass: 'commercial_api' },
  censys: { queryClass: 'attack_surface_context', termsClass: 'commercial_api' },
};

function usage() {
  console.log('Usage: node scripts/run-intelligence-enrichment.js <intelligence-request.json> [--out <enrichment.json>]');
}

function parseArgs(argv) {
  const args = { input: null, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--out') { args.out = argv[++i]; continue; }
    if (!args.input) { args.input = item; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.input) throw new Error('Missing intelligence request path.');
  return args;
}

function abs(file) { return path.isAbsolute(file) ? file : path.join(ROOT, file); }
function readJson(file) { return JSON.parse(fs.readFileSync(abs(file), 'utf8')); }
function writeJson(file, value) {
  const out = abs(file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}
function hash(value) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}
function validate(schemaRel, value, label) {
  const schema = readJson(schemaRel);
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validator = ajv.compile(schema);
  if (!validator(value)) {
    const details = (validator.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
    throw new Error(`${label} failed schema validation: ${details}`);
  }
}

function applicable(provider, indicator) {
  if (provider === 'virustotal') return ['sha256', 'sha1', 'md5', 'domain', 'ip', 'url'].includes(indicator.kind);
  if (provider === 'greynoise') return indicator.kind === 'ip';
  if (provider === 'urlscan') return ['url', 'domain'].includes(indicator.kind);
  if (['cisa_kev', 'epss', 'nvd'].includes(provider)) return indicator.kind === 'cve';
  if (['osv', 'github_advisory'].includes(provider)) return ['package', 'repository'].includes(indicator.kind);
  if (['mandiant', 'recorded_future'].includes(provider)) return ['sha256', 'sha1', 'md5', 'ip', 'domain', 'url', 'cve'].includes(indicator.kind);
  if (['shodan', 'censys'].includes(provider)) return ['ip', 'domain', 'certificate'].includes(indicator.kind);
  return false;
}

function classify(provider, indicator) {
  if (provider === 'virustotal' && ['sha256', 'sha1', 'md5'].includes(indicator.kind)) return ['malware_reputation', 'high', 0.86, 'Artifact reputation enrichment available through VirusTotal lane.'];
  if (provider === 'greynoise') return ['internet_noise', 'medium', 0.76, 'Internet background-noise context available through GreyNoise lane.'];
  if (provider === 'urlscan') return ['phishing', 'medium', 0.66, 'URL and web artifact analysis available through urlscan lane.'];
  if (provider === 'cisa_kev') return ['known_exploited_vulnerability', 'critical', 0.92, 'Known-exploited-vulnerability prioritization lane.'];
  if (provider === 'epss') return ['exploit_probability', 'high', 0.81, 'Exploit probability enrichment lane.'];
  if (provider === 'nvd') return ['exploit_probability', 'medium', 0.7, 'Vulnerability metadata enrichment lane.'];
  if (['osv', 'github_advisory'].includes(provider)) return ['package_vulnerability', 'medium', 0.76, 'Supply-chain vulnerability enrichment lane.'];
  if (['mandiant', 'recorded_future'].includes(provider)) return ['campaign_context', 'high', 0.78, 'Threat actor, malware family, and campaign-context enrichment lane.'];
  if (['shodan', 'censys'].includes(provider)) return ['exposure_context', 'medium', 0.69, 'External attack-surface context enrichment lane.'];
  return ['benign_reputation', 'info', 0.5, 'No elevated context found.'];
}

function enrich(request) {
  if (request.mode !== 'fixture') throw new Error('v0.1 intelligence enrichment is fixture-only; live_read_only adapters require explicit provider policy.');
  const now = new Date().toISOString();
  const receipts = [];
  const observations = [];
  const graphEdges = [];
  const providers = request.providers || [];

  for (const indicator of request.indicators || []) {
    for (const provider of providers) {
      const providerConfig = PROVIDERS[provider];
      if (!providerConfig || !applicable(provider, indicator)) continue;
      const base = `${slug(provider)}-${slug(indicator.indicatorId.replace(/^indicator:/, ''))}`;
      const evidence = { provider, indicatorRef: indicator.indicatorId, kind: indicator.kind, value: indicator.value, mode: request.mode };
      const receiptId = `intelligence-receipt:${base}`;
      const [category, severity, confidence, summary] = classify(provider, indicator);
      receipts.push({
        receiptId,
        provider,
        indicatorRef: indicator.indicatorId,
        queryClass: providerConfig.queryClass,
        queriedAt: now,
        mode: request.mode,
        termsClass: 'internal_fixture',
        cacheKey: `${provider}:${indicator.kind}:${slug(indicator.value)}`,
        evidenceHash: hash(evidence),
        liveConnectionUsed: false,
        executionPerformed: false,
      });
      const observationId = `intelligence-observation:${base}`;
      observations.push({
        observationId,
        indicatorRef: indicator.indicatorId,
        provider,
        category,
        confidence,
        severity,
        summary,
        evidenceRefs: [receiptId],
      });
      graphEdges.push(
        { edgeId: `cyber-graph-edge:${base}-enriched-by`, from: indicator.indicatorId, predicate: 'enriched_by', to: `provider:${provider}`, sourceRefs: [receiptId], confidence },
        { edgeId: `cyber-graph-edge:${base}-observed-as`, from: indicator.indicatorId, predicate: 'observed_as', to: `observation:${category}`, sourceRefs: [observationId], confidence },
        { edgeId: `cyber-graph-edge:${base}-detection`, from: observationId, predicate: 'should_generate_detection', to: `detection-candidate:${category}`, sourceRefs: [receiptId], confidence }
      );
    }
  }

  if (receipts.length === 0) throw new Error('No provider lanes applied to request indicators.');
  return {
    schemaVersion: '0.1.0',
    enrichmentId: `intelligence-enrichment:${slug(request.requestId.replace(/^intelligence-request:/, ''))}`,
    generatedAt: now,
    mode: request.mode,
    sourceSet: Array.from(new Set(providers)).sort(),
    indicators: request.indicators,
    receipts,
    observations,
    graphEdges,
    executionPerformed: false,
  };
}

function main() {
  const args = parseArgs(process.argv);
  const request = readJson(args.input);
  const enrichment = enrich(request);
  validate(ENRICHMENT_SCHEMA, enrichment, 'intelligence enrichment');
  if (args.out) writeJson(args.out, enrichment);
  process.stdout.write(`${JSON.stringify(enrichment, null, 2)}\n`);
}

try { main(); } catch (err) { console.error(`run-intelligence-enrichment failed: ${err.message}`); process.exit(1); }
