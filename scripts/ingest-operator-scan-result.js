#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const RESULT_SCHEMA = 'config/schemas/operator-scan-result.schema.json';
const ASSESSMENT_SCHEMA = 'config/schemas/operator-scan-result-assessment.schema.json';

function usage() {
  console.log('Usage: node scripts/ingest-operator-scan-result.js <operator-scan-result.json> [--out <assessment.json>]');
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
  if (!args.input) throw new Error('Missing operator scan result path.');
  return args;
}

function abs(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT, file);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(abs(file), 'utf8'));
}

function writeJson(file, value) {
  const out = abs(file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'scan';
}

function severity(category) {
  return {
    missing_tls: 'high',
    weak_tls_metadata: 'medium',
    unexpected_open_port: 'high',
    http_exposure: 'medium',
    service_banner_present: 'low',
    policy_scope_mismatch: 'critical',
    unresolved_target: 'medium',
    scan_incomplete: 'low'
  }[category] || 'informational';
}

function score(sev) {
  return { critical: 30, high: 20, medium: 10, low: 5, informational: 0 }[sev] || 0;
}

function riskLevel(total) {
  if (total >= 70) return 'critical';
  if (total >= 40) return 'high';
  if (total >= 15) return 'medium';
  return 'low';
}

function recommendation(category) {
  return {
    missing_tls: 'Require TLS for exposed web endpoints and verify certificate metadata.',
    weak_tls_metadata: 'Review TLS metadata and enforce current protocol/cipher policy.',
    unexpected_open_port: 'Verify port exposure against authorized target scope and close unexpected services.',
    http_exposure: 'Review HTTP exposure and require approved ingress, headers, and transport policy.',
    service_banner_present: 'Reduce service banner disclosure where operationally feasible.',
    policy_scope_mismatch: 'Stop assessment and correct scan policy scope before proceeding.',
    unresolved_target: 'Validate target resolution before further assessment.',
    scan_incomplete: 'Record incomplete scan state and rerun only under policy authorization.'
  }[category] || 'Review observation and determine whether a control is required.';
}

function findingFromObservation(result, observation) {
  if (!observation.findingHint || observation.findingHint === 'none') return null;
  const sev = severity(observation.findingHint);
  return {
    id: `scan-finding:${slug(result.targetRef)}-${slug(observation.findingHint)}-${slug(observation.observationId)}`,
    category: observation.findingHint,
    severity: sev,
    observationRef: observation.observationId,
    evidence: observation.evidence,
    recommendation: recommendation(observation.findingHint)
  };
}

function assess(result, resultRef) {
  const findings = result.observations.map((observation) => findingFromObservation(result, observation)).filter(Boolean);
  const riskScore = Math.min(100, findings.reduce((sum, finding) => sum + score(finding.severity), 0));
  return {
    schemaVersion: '0.1.0',
    assessmentId: `operator-scan-result-assessment:${slug(result.resultId.replace(/^operator-scan-result:/, ''))}`,
    resultRef,
    targetRef: result.targetRef,
    surfaceKind: result.surfaceKind,
    riskScore,
    riskLevel: riskLevel(riskScore),
    findingCount: findings.length,
    findings,
    recommendedControls: Array.from(new Set(findings.map((finding) => finding.recommendation))),
    createdAt: new Date().toISOString(),
    networkAccessAttempted: false,
    scanExecutionPerformed: false,
  };
}

try {
  const args = parseArgs(process.argv);
  const result = readJson(args.input);
  validate(RESULT_SCHEMA, result, 'operator scan result');
  if (result.networkAccessAttempted !== false) throw new Error('Scan result ingestion refuses networkAccessAttempted=true.');
  if (result.scanExecutionPerformed !== false) throw new Error('Scan result ingestion refuses scanExecutionPerformed=true.');
  if (result.credentialAccessAttempted !== false || result.payloadDeliveryAttempted !== false || result.mutationAttempted !== false) {
    throw new Error('Scan result ingestion refuses credential, payload, or mutation attempts.');
  }
  const assessment = assess(result, args.input);
  validate(ASSESSMENT_SCHEMA, assessment, 'operator scan result assessment');
  if (args.out) writeJson(args.out, assessment);
  process.stdout.write(`${JSON.stringify(assessment, null, 2)}\n`);
} catch (err) {
  console.error(`ingest-operator-scan-result failed: ${err.message}`);
  process.exit(1);
}
