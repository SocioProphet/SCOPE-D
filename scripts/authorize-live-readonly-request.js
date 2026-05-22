#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const REQUEST_SCHEMA = 'config/schemas/operator-live-readonly-request.schema.json';
const POLICY_SCHEMA = 'config/schemas/operator-live-readonly-policy.schema.json';
const DECISION_SCHEMA = 'config/schemas/operator-live-readonly-decision.schema.json';

function usage() {
  console.log('Usage: node scripts/authorize-live-readonly-request.js <request.json> [--policy <policy.json>] [--out <decision.json>]');
}

function parseArgs(argv) {
  const args = { request: null, policy: null, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--policy') { args.policy = argv[++i]; continue; }
    if (item === '--out') { args.out = argv[++i]; continue; }
    if (!args.request) { args.request = item; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.request) throw new Error('Missing request path.');
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
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'decision';
}

function has(list, value) {
  return Array.isArray(list) && list.includes(value);
}

function evaluate(policy, request) {
  if (policy.operatorId !== request.operatorId) return ['hard_block', `Operator ${request.operatorId} does not match policy operator ${policy.operatorId}.`];
  if (!has(policy.authorizedTargets, request.targetRef)) return ['hard_block', `Target ${request.targetRef} is not authorized by policy.`];
  if (!has(policy.authorizedSurfaces, request.surfaceKind)) return ['hard_block', `Surface ${request.surfaceKind} is not authorized by policy.`];
  if (!has(policy.allowedReadMethods, request.readMethod)) return ['hard_block', `Read method ${request.readMethod} is not allowed by policy.`];
  if (request.toolInvocationRequested) return ['hard_block', 'Request attempted tool invocation.'];
  if (request.promptExecutionRequested) return ['hard_block', 'Request attempted prompt execution.'];
  if (request.mutationRequested) return ['hard_block', 'Request attempted mutation.'];
  if (request.credentialAccessRequested) return ['hard_block', 'Request attempted credential access.'];
  if (policy.executionAllowed !== false) return ['hard_block', 'Policy executionAllowed must be false.'];
  return ['allow', 'Request is authorized for live read-only observation. No execution performed.'];
}

function main() {
  const args = parseArgs(process.argv);
  const request = readJson(args.request);
  validate(REQUEST_SCHEMA, request, 'live read-only request');
  const policyPath = args.policy || request.policyRef;
  const policy = readJson(policyPath);
  validate(POLICY_SCHEMA, policy, 'live read-only policy');
  const [decision, reason] = evaluate(policy, request);
  const output = {
    schemaVersion: '0.1.0',
    decisionId: `operator-live-readonly-decision:${slug(request.requestId.replace(/^operator-live-readonly-request:/, ''))}`,
    requestId: request.requestId,
    policyId: policy.policyId,
    operatorId: request.operatorId,
    targetRef: request.targetRef,
    surfaceKind: request.surfaceKind,
    readMethod: request.readMethod,
    decision,
    reason,
    createdAt: new Date().toISOString(),
    auditRequired: policy.auditRequired,
    executionAllowed: false,
    executionPerformed: false,
  };
  validate(DECISION_SCHEMA, output, 'live read-only decision');
  if (args.out) writeJson(args.out, output);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (decision === 'hard_block') process.exitCode = 2;
}

try {
  main();
} catch (err) {
  console.error(`authorize-live-readonly-request failed: ${err.message}`);
  process.exit(1);
}
