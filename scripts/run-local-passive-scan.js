#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const PLAN_SCHEMA = 'config/schemas/operator-scan-plan.schema.json';
const SOURCE_SCHEMA = 'config/schemas/operator-local-passive-scan-source.schema.json';
const RESULT_SCHEMA = 'config/schemas/operator-scan-result.schema.json';

function usage() {
  console.log('Usage: node scripts/run-local-passive-scan.js --plan <operator-scan-plan.json> --source <local-passive-source.json> [--out <operator-scan-result.json>]');
}

function parseArgs(argv) {
  const args = { plan: null, source: null, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--plan') { args.plan = argv[++i]; continue; }
    if (item === '--source') { args.source = argv[++i]; continue; }
    if (item === '--out') { args.out = argv[++i]; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.plan) throw new Error('--plan is required.');
  if (!args.source) throw new Error('--source is required.');
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

function main() {
  const args = parseArgs(process.argv);
  const plan = readJson(args.plan);
  const source = readJson(args.source);
  validate(PLAN_SCHEMA, plan, 'operator scan plan');
  validate(SOURCE_SCHEMA, source, 'local passive scan source');

  if (plan.scanExecutionAllowed !== false || plan.scanExecutionPerformed !== false) throw new Error('Local passive scan refuses executable plans.');
  if (source.networkAccessAttempted !== false || source.scanExecutionPerformed !== false) throw new Error('Local passive source must not record network or scan execution.');
  if (source.credentialAccessAttempted !== false || source.payloadDeliveryAttempted !== false || source.mutationAttempted !== false) {
    throw new Error('Local passive source must not record credential, payload, or mutation attempts.');
  }
  if (plan.targetRef !== source.targetRef) throw new Error(`Target mismatch: plan=${plan.targetRef} source=${source.targetRef}`);
  if (plan.surfaceKind !== source.surfaceKind) throw new Error(`Surface mismatch: plan=${plan.surfaceKind} source=${source.surfaceKind}`);

  const allowed = new Set(plan.plannedMethods);
  const observations = source.observations
    .filter((observation) => allowed.has(observation.method))
    .map((observation, index) => ({
      observationId: `scan-observation:${slug(source.targetRef)}-${index + 1}-${slug(observation.method)}`,
      method: observation.method,
      status: observation.status,
      evidence: observation.evidence,
      findingHint: observation.findingHint,
    }));

  if (observations.length === 0) throw new Error('No source observations matched planned methods.');

  const result = {
    schemaVersion: '0.1.0',
    resultId: `operator-scan-result:${slug(source.sourceId.replace(/^operator-local-passive-scan-source:/, ''))}`,
    policyRef: plan.policyRef,
    requestRef: plan.requestRef,
    decisionRef: plan.decisionRef,
    planRef: args.plan,
    dryRunReceiptRef: 'not-required:local-passive-executor',
    targetRef: plan.targetRef,
    surfaceKind: plan.surfaceKind,
    resultSource: source.sourceKind === 'synthetic' ? 'synthetic' : 'local_passive',
    observedAt: source.observedAt,
    observations,
    redactionState: source.redactionState,
    networkAccessAttempted: false,
    scanExecutionPerformed: false,
    credentialAccessAttempted: false,
    payloadDeliveryAttempted: false,
    mutationAttempted: false,
  };

  validate(RESULT_SCHEMA, result, 'operator scan result');
  if (args.out) writeJson(args.out, result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  console.error(`run-local-passive-scan failed: ${err.message}`);
  process.exit(1);
}
