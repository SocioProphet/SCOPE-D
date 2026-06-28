#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_SCHEMA = 'config/schemas/intelligence-enrichment.schema.json';

const PROVIDER_CAPABILITIES = {
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
  console.log('Usage: node scripts/enrich-indicators.js <indicator-request.json> [--out <intelligence-enrichment.json>]');
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
  if (!args.input) throw new Error('Missing indicator request path.');
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
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'indicator';
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function validateOutput(value) {
  const schema = readJson(OUTPUT_SCHEMA);
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validator = ajv.compile(schema);
  if (!validator(value)) {
    const details = (validator.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
    throw new Error(`intelligence enrichment failed schema validation: ${details}`);
  }
}

function observationFor(provider, indicator, receiptRef) {
  if (provider === 'virustotal' && ['sha256', 'sha1', 'md5', 'url', 'domain', 'ip'].includes(indicator.kind)) {
    return { category: 'malware_reputation', confidence: 0.74, severity: indicator.kind === 'sha256' ? 'high' : 'medium', summary: `${provider} fixture reputation context for ${indicator.kind}` };
  }
  if (provider === 'greynoise' && indicator.kind === 'ip') {
    return { category: 'internet_noise', confidence: 0.82, severity: 'low', summary: 'GreyNoise fixture classifies this IP as broad internet scan context, reducing targetedness confidence.' };
  }
  if (provider === 'cisa_kev' && indicator.kind === 'cve') {
    return { category: 'known_exploited_vulnerability', confidence: 0.9, severity: 'critical', summary: 'CISA KEV fixture marks this vulnerability as known exploited or KEV-watch relevant.' };
  }
  if (provider === 'epss' && indicator.kind === 'cve') {
    return { category: 'exploit_probability', confidence: 0.78, severity: 'high', summary: 'EPSS fixture supplies exploit-probability prioritization context.' };
  }
  if (provider === 'nvd' && indicator.kind === 'cve') {
    return { category: 'known_exploited_vulnerability', confidence: 0.66, severity: 'high', summary: 'NVD fixture supplies vulnerability metadata context.' };
  }
  if ((provider === 'osv' || provider === 'github_advisory') && indicator.kind === 'package') {
    return { category: 'package_vulnerability', confidence: 0.71, severity: 'medium', summary: `${provider} fixture supplies package advisory context.` };
  }
  if ((provider === 'shodan' || provider === 'censys') && ['ip', 'domain'].includes(indicator.kind)) {
    return { category: 'exposure_context', confidence: 0.69, severity: 'medium', summary: `${provider} fixture supplies external exposure context without active scanning.` };
  }
  if ((provider === 'mandiant' || provider === 'recorded_future') && ['sha256', 'domain', 'ip', 'url', 'cve'].includes(indicator.kind)) {
    return { category: 'campaign_context', confidence: 0.63, severity: 'medium', summary: `${provider} fixture supplies adversary/campaign context placeholder.` };
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv);
  const request = readJson(args.input);
  if (request.mode !== 'fixture' && request.mode !== 'live_read_only') throw new Error('mode must be fixture or live_read_only.');
  if (request.mode === 'live_read_only') throw new Error('live_read_only adapters are not implemented in this slice; fixture mode only.');
  if (!Array.isArray(request.indicators) || request.indicators.length === 0) throw new Error('request.indicators must be non-empty.');
  const providers = request.providers || [];
  if (providers.length === 0) throw new Error('request.providers must be non-empty.');
  for (const provider of providers) if (!PROVIDER_CAPABILITIES[provider]) throw new Error(`unknown provider: ${provider}`);

  const now = new Date().toISOString();
  const base = slug(request.requestId.replace(/^intelligence-request:/, ''));
  const receipts = [];
  const observations = [];
  const graphEdges = [];

  for (const indicator of request.indicators) {
    for (const provider of providers) {
      const obs = observationFor(provider, indicator);
      if (!obs) continue;
      const providerCapability = PROVIDER_CAPABILITIES[provider];
      const receiptId = `intelligence-receipt:${base}-${slug(indicator.indicatorId)}-${provider}`;
      const evidenceHash = `sha256:${sha256(JSON.stringify({ provider, indicator, obs }))}`;
      receipts.push({
        receiptId,
        provider,
        indicatorRef: indicator.indicatorId,
        queryClass: providerCapability.queryClass,
        queriedAt: now,
        mode: request.mode,
        termsClass: providerCapability.termsClass === 'commercial_api' ? 'internal_fixture' : providerCapability.termsClass,
        cacheKey: `${provider}:${indicator.kind}:${sha256(indicator.value)}`,
        evidenceHash,
        liveConnectionUsed: false,
        executionPerformed: false,
      });
      const observationId = `intelligence-observation:${base}-${slug(indicator.indicatorId)}-${provider}`;
      observations.push({
        observationId,
        indicatorRef: indicator.indicatorId,
        provider,
        category: obs.category,
        confidence: obs.confidence,
        severity: obs.severity,
        summary: obs.summary,
        evidenceRefs: [receiptId],
      });
      graphEdges.push({
        edgeId: `cyber-graph-edge:${base}-${slug(indicator.indicatorId)}-${provider}-enriched-by`,
        from: indicator.indicatorId,
        predicate: 'enriched_by',
        to: `provider:${provider}`,
        sourceRefs: [receiptId],
        confidence: obs.confidence,
      });
      graphEdges.push({
        edgeId: `cyber-graph-edge:${base}-${slug(indicator.indicatorId)}-${provider}-${slug(obs.category)}`,
        from: indicator.indicatorId,
        predicate: obs.category.includes('vulnerability') || obs.category.includes('exploit') ? 'prioritized_by' : 'has_verdict',
        to: `intelligence-category:${obs.category}`,
        sourceRefs: [observationId, receiptId],
        confidence: obs.confidence,
      });
    }
  }

  if (receipts.length === 0) throw new Error('No provider observations produced for supplied indicators.');
  const enrichment = {
    schemaVersion: '0.1.0',
    enrichmentId: `intelligence-enrichment:${base}`,
    generatedAt: now,
    mode: request.mode,
    sourceSet: providers,
    indicators: request.indicators,
    receipts,
    observations,
    graphEdges,
    executionPerformed: false,
  };
  validateOutput(enrichment);
  if (args.out) writeJson(args.out, enrichment);
  process.stdout.write(`${JSON.stringify(enrichment, null, 2)}\n`);
}

try { main(); } catch (err) { console.error(`enrich-indicators failed: ${err.message}`); process.exit(1); }
