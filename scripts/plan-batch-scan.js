#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const BATCH_SCHEMA = 'config/schemas/scan-target-batch.schema.json';
const BATCH_PLAN_SCHEMA = 'config/schemas/scan-target-batch-plan.schema.json';
const SINGLE_PLANNER = path.join(ROOT, 'scripts', 'plan-operator-scan.js');

function usage() {
  console.log('Usage: node scripts/plan-batch-scan.js <scan-target-batch.json> [--policy <operator-scan-policy.json>] [--out-dir <dir>]');
}

function parseArgs(argv) {
  const args = { batch: null, policy: null, outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--policy') { args.policy = argv[++i]; continue; }
    if (item === '--out-dir') { args.outDir = argv[++i]; continue; }
    if (!args.batch) { args.batch = item; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.batch) throw new Error('Missing scan target batch path.');
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
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'batch';
}

function buildRequest(batch, target) {
  return {
    schemaVersion: '0.1.0',
    requestId: `operator-scan-request:${slug(batch.batchId.replace(/^scan-target-batch:/, ''))}-${slug(target.targetRef)}`,
    operatorId: batch.operatorId,
    policyRef: batch.policyRef,
    targetRef: target.targetRef,
    surfaceKind: target.surfaceKind,
    requestedMethods: batch.requestedMethods,
    requestedAt: batch.requestedAt,
    scanExecutionRequested: batch.scanExecutionRequested,
    credentialAccessRequested: batch.credentialAccessRequested,
    payloadDeliveryRequested: batch.payloadDeliveryRequested,
    mutationRequested: batch.mutationRequested,
  };
}

function runSinglePlanner(requestPath, policyPath, outDir) {
  const result = cp.spawnSync(process.execPath, [SINGLE_PLANNER, requestPath, '--policy', policyPath, '--out-dir', outDir], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (![0, 2].includes(result.status)) {
    throw new Error(`single-target planner failed with ${result.status}: ${result.stderr || result.stdout}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (err) {
    throw new Error(`single-target planner emitted invalid JSON: ${err.message}`);
  }
}

function main() {
  const args = parseArgs(process.argv);
  const batchPath = abs(args.batch);
  const batch = readJson(batchPath);
  validate(BATCH_SCHEMA, batch, 'scan target batch');
  const policyPath = abs(args.policy || batch.policyRef);
  const outDir = abs(args.outDir || path.join('runs', `scan-target-batch-${slug(batch.batchId.replace(/^scan-target-batch:/, ''))}`));
  if (fs.existsSync(outDir)) throw new Error(`Output directory already exists: ${rel(outDir)}`);
  fs.mkdirSync(outDir, { recursive: true });

  const targetPlans = [];
  for (const target of batch.targets) {
    const targetDir = path.join(outDir, 'targets', slug(target.targetRef));
    fs.mkdirSync(targetDir, { recursive: true });
    const request = buildRequest(batch, target);
    const requestPath = path.join(targetDir, 'operator-scan-request.json');
    writeJson(requestPath, request);
    const result = runSinglePlanner(requestPath, policyPath, targetDir);
    targetPlans.push({
      targetRef: target.targetRef,
      surfaceKind: target.surfaceKind,
      status: result.decision.decision,
      requestRef: rel(requestPath),
      decisionRef: rel(path.join(targetDir, 'operator-scan-decision.json')),
      planRef: result.planRef ? rel(path.join(targetDir, 'operator-scan-plan.json')) : null,
      blockedMethods: result.decision.blockedMethods || [],
    });
  }

  const allowedCount = targetPlans.filter((item) => item.status === 'allow_plan').length;
  const blockedCount = targetPlans.filter((item) => item.status === 'hard_block').length;
  if (batch.batchFailureMode === 'block_entire_batch' && blockedCount > 0) {
    for (const item of targetPlans) {
      if (item.status === 'allow_plan') {
        item.status = 'hard_block';
        item.blockedMethods = ['batch_blocked_due_to_invalid_target'];
        item.planRef = null;
      }
    }
  }

  const finalAllowed = targetPlans.filter((item) => item.status === 'allow_plan').length;
  const finalBlocked = targetPlans.filter((item) => item.status === 'hard_block').length;
  const batchPlan = {
    schemaVersion: '0.1.0',
    batchPlanId: `scan-target-batch-plan:${slug(batch.batchId.replace(/^scan-target-batch:/, ''))}`,
    sourceBatchRef: rel(batchPath),
    policyRef: rel(policyPath),
    createdAt: new Date().toISOString(),
    targetCount: targetPlans.length,
    allowedCount: finalAllowed,
    blockedCount: finalBlocked,
    targets: targetPlans,
    executionAllowed: false,
    executionPerformed: false,
  };
  validate(BATCH_PLAN_SCHEMA, batchPlan, 'scan target batch plan');
  writeJson(path.join(outDir, 'scan-target-batch-plan.json'), batchPlan);
  process.stdout.write(`${JSON.stringify(batchPlan, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  console.error(`plan-batch-scan failed: ${err.message}`);
  process.exit(1);
}
