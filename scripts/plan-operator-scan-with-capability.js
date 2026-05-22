#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AUTH = path.join(ROOT, 'scripts', 'authorize-capability-gate.js');
const PLAN = path.join(ROOT, 'scripts', 'plan-operator-scan.js');

function usage() {
  console.log('Usage: node scripts/plan-operator-scan-with-capability.js --request <scan-request.json> --policy <scan-policy.json> --gate <capability-gate.json> [--out-dir <dir>]');
}

function parseArgs(argv) {
  const args = { request: null, policy: null, gate: null, outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--request') { args.request = argv[++i]; continue; }
    if (item === '--policy') { args.policy = argv[++i]; continue; }
    if (item === '--gate') { args.gate = argv[++i]; continue; }
    if (item === '--out-dir') { args.outDir = argv[++i]; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  for (const key of ['request', 'policy', 'gate']) {
    if (!args[key]) throw new Error(`--${key} is required.`);
  }
  return args;
}

function abs(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT, file);
}

function run(label, commandArgs, allowedStatuses) {
  const result = cp.spawnSync(process.execPath, commandArgs, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  if (!allowedStatuses.includes(result.status)) {
    throw new Error(`${label} failed with ${result.status}: ${result.stderr || result.stdout}`);
  }
  return result;
}

function parseJson(text, label) {
  try { return JSON.parse(text); } catch (err) { throw new Error(`${label} did not emit JSON: ${err.message}`); }
}

try {
  const args = parseArgs(process.argv);
  const outDir = abs(args.outDir || path.join('runs', 'operator-scan-with-capability'));
  fs.mkdirSync(outDir, { recursive: true });
  const capabilityDecisionPath = path.join(outDir, 'operator-capability-gate-decision.json');

  const auth = run('capability gate authorization', [
    AUTH,
    '--request', abs(args.request),
    '--gate', abs(args.gate),
    '--out', capabilityDecisionPath,
  ], [0, 2]);
  const capabilityDecision = parseJson(auth.stdout, 'capability gate decision');

  if (capabilityDecision.decision !== 'allow_mode') {
    process.stdout.write(`${JSON.stringify({ capabilityDecision, scanPlan: null }, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }

  const scanPlan = run('scan planner', [
    PLAN,
    abs(args.request),
    '--policy', abs(args.policy),
    '--out-dir', outDir,
  ], [0]);
  const scanOutput = parseJson(scanPlan.stdout, 'scan planner output');

  process.stdout.write(`${JSON.stringify({ capabilityDecision, scanPlan: scanOutput }, null, 2)}\n`);
} catch (err) {
  console.error(`plan-operator-scan-with-capability failed: ${err.message}`);
  process.exit(1);
}
