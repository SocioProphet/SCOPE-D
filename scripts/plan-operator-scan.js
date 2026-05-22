#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const POLICY_SCHEMA = 'config/schemas/operator-scan-policy.schema.json';
const REQUEST_SCHEMA = 'config/schemas/operator-scan-request.schema.json';
const DECISION_SCHEMA = 'config/schemas/operator-scan-decision.schema.json';
const PLAN_SCHEMA = 'config/schemas/operator-scan-plan.schema.json';

function usage() {
  console.log('Usage: node scripts/plan-operator-scan.js <scan-request.json> [--policy <scan-policy.json>] [--out-dir <dir>]');
}

function parseArgs(argv) {
  const args = { request: null, policy: null, outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--policy') { args.policy = argv[++i]; continue; }
    if (item === '--out-dir') { args.outDir = argv[++i]; continue; }
    if (!args.request) { args.request = item; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.request) throw new Error('Missing scan request path.');
  return args;
}

function abs(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT, file);
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
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

function targetAuthorized(policy, targetRef) {
  return policy.authorizedTargets.some((target) => target.targetRef === targetRef);
}

function evaluate(policy, request) {
  const blocked = [];
  const allowed = [];

  if (policy.operatorId !== request.operatorId) blocked.push('operator_mismatch');
  if (!targetAuthorized(policy, request.targetRef)) blocked.push('target_not_authorized');
  if (!policy.allowedSurfaces.includes(request.surfaceKind)) blocked.push('surface_not_authorized');
  if (request.credentialAccessRequested) blocked.push('credential_access_requested');
  if (request.payloadDeliveryRequested) blocked.push('payload_delivery_requested');
  if (request.mutationRequested) blocked.push('mutation_requested');

  for (const method of request.requestedMethods) {
    if (policy.blockedMethods.includes(method)) blocked.push(method);
    else if (policy.allowedScanMethods.includes(method)) allowed.push(method);
    else blocked.push(`method_not_allowed:${method}`);
  }

  if (blocked.length > 0) {
    return {
      decision: 'hard_block',
      allowedMethods: [],
      blockedMethods: Array.from(new Set(blocked)).sort(),
      reason: `Scan request blocked: ${Array.from(new Set(blocked)).sort().join(', ')}`,
    };
  }

  return {
    decision: 'allow_plan',
    allowedMethods: Array.from(new Set(allowed)).sort(),
    blockedMethods: [],
    reason: 'Scan request authorized for planning only. No scan execution performed.',
  };
}

function main() {
  const args = parseArgs(process.argv);
  const requestPath = abs(args.request);
  const request = readJson(requestPath);
  validate(REQUEST_SCHEMA, request, 'operator scan request');
  const policyPath = abs(args.policy || request.policyRef);
  const policy = readJson(policyPath);
  validate(POLICY_SCHEMA, policy, 'operator scan policy');

  const outcome = evaluate(policy, request);
  const now = new Date().toISOString();
  const base = slug(request.requestId.replace(/^operator-scan-request:/, ''));
  const outDir = abs(args.outDir || path.join('runs', `operator-scan-plan-${base}`));
  fs.mkdirSync(outDir, { recursive: true });
  const decisionPath = path.join(outDir, 'operator-scan-decision.json');
  const planPath = path.join(outDir, 'operator-scan-plan.json');

  const decision = {
    schemaVersion: '0.1.0',
    decisionId: `operator-scan-decision:${base}`,
    requestId: request.requestId,
    policyId: policy.policyId,
    operatorId: request.operatorId,
    targetRef: request.targetRef,
    surfaceKind: request.surfaceKind,
    decision: outcome.decision,
    allowedMethods: outcome.allowedMethods,
    blockedMethods: outcome.blockedMethods,
    reason: outcome.reason,
    createdAt: now,
    scanExecutionAllowed: false,
    scanExecutionPerformed: false,
  };
  validate(DECISION_SCHEMA, decision, 'operator scan decision');
  writeJson(decisionPath, decision);

  if (outcome.decision === 'allow_plan') {
    const plan = {
      schemaVersion: '0.1.0',
      planId: `operator-scan-plan:${base}`,
      decisionRef: rel(decisionPath),
      requestRef: rel(requestPath),
      policyRef: rel(policyPath),
      targetRef: request.targetRef,
      surfaceKind: request.surfaceKind,
      plannedMethods: outcome.allowedMethods,
      rateLimit: policy.rateLimit,
      createdAt: now,
      scanExecutionAllowed: false,
      scanExecutionPerformed: false,
    };
    validate(PLAN_SCHEMA, plan, 'operator scan plan');
    writeJson(planPath, plan);
  }

  const output = { decision, planRef: outcome.decision === 'allow_plan' ? rel(planPath) : null };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (outcome.decision === 'hard_block') process.exitCode = 2;
}

try {
  main();
} catch (err) {
  console.error(`plan-operator-scan failed: ${err.message}`);
  process.exit(1);
}
