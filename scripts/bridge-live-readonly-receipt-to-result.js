#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const RECEIPT_SCHEMA = 'config/schemas/operator-live-readonly-scan-receipt.schema.json';
const RESULT_SCHEMA = 'config/schemas/operator-scan-result.schema.json';

function usage() {
  console.log('Usage: node scripts/bridge-live-readonly-receipt-to-result.js <live-readonly-receipt.json> --policy <policyRef> --request <requestRef> --decision <decisionRef> [--out <operator-scan-result.json>]');
}

function parseArgs(argv) {
  const args = { input: null, policy: null, request: null, decision: null, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--policy') { args.policy = argv[++i]; continue; }
    if (item === '--request') { args.request = argv[++i]; continue; }
    if (item === '--decision') { args.decision = argv[++i]; continue; }
    if (item === '--out') { args.out = argv[++i]; continue; }
    if (!args.input) { args.input = item; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  for (const key of ['input', 'policy', 'request', 'decision']) {
    if (!args[key]) throw new Error(`${key} is required.`);
  }
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
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'live-readonly';
}

function mapStatus(status) {
  if (status === 'not_supported') return 'not_executed';
  return status;
}

function mapObservation(receipt, item, index) {
  return {
    observationId: `scan-observation:${slug(receipt.targetRef)}-${index + 1}-${slug(item.method)}`,
    method: item.method,
    status: mapStatus(item.status),
    evidence: item.evidence,
    findingHint: item.findingHint,
  };
}

try {
  const args = parseArgs(process.argv);
  const receipt = readJson(args.input);
  validate(RECEIPT_SCHEMA, receipt, 'live read-only scan receipt');
  if (receipt.credentialAccessAttempted !== false || receipt.payloadDeliveryAttempted !== false || receipt.mutationAttempted !== false || receipt.destructiveBehaviorAttempted !== false) {
    throw new Error('Receipt includes prohibited attempt flags.');
  }

  const result = {
    schemaVersion: '0.1.0',
    resultId: `operator-scan-result:${slug(receipt.receiptId.replace(/^operator-live-readonly-scan-receipt:/, ''))}`,
    policyRef: args.policy,
    requestRef: args.request,
    decisionRef: args.decision,
    planRef: receipt.planRef,
    dryRunReceiptRef: args.input,
    targetRef: receipt.targetRef,
    surfaceKind: receipt.surfaceKind,
    resultSource: receipt.mode === 'live_readonly' ? 'live_readonly' : 'fixture',
    observedAt: receipt.createdAt,
    observations: receipt.observations.map((item, index) => mapObservation(receipt, item, index)),
    redactionState: 'redacted',
    networkAccessAttempted: receipt.networkAccessAttempted === true,
    scanExecutionPerformed: false,
    credentialAccessAttempted: false,
    payloadDeliveryAttempted: false,
    mutationAttempted: false,
  };

  validate(RESULT_SCHEMA, result, 'operator scan result');
  if (args.out) writeJson(args.out, result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (err) {
  console.error(`bridge-live-readonly-receipt-to-result failed: ${err.message}`);
  process.exit(1);
}
