#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PLANNER = path.join(ROOT, 'scripts', 'plan-operator-scan.js');
const DRY_RUN = path.join(ROOT, 'scripts', 'dry-run-operator-scan.js');
const REQUEST = path.join(ROOT, 'examples', 'scope-d', 'operator-scan-request.example.json');
const POLICY = path.join(ROOT, 'examples', 'scope-d', 'operator-scan-policy.example.json');

function fail(message, result) {
  console.error(message);
  if (result) {
    if (result.stdout) console.error(`stdout:\n${result.stdout}`);
    if (result.stderr) console.error(`stderr:\n${result.stderr}`);
  }
  process.exit(1);
}

function parseJson(text, label, result) {
  try { return JSON.parse(text); } catch (err) { fail(`${label}: expected JSON output: ${err.message}`, result); }
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-scan-dry-run-'));
const planDir = path.join(tmpDir, 'plan');
const receiptPath = path.join(tmpDir, 'dry-run-receipt.json');

const planned = cp.spawnSync(process.execPath, [PLANNER, REQUEST, '--policy', POLICY, '--out-dir', planDir], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (planned.status !== 0) fail(`Expected scan planner success, got ${planned.status}`, planned);
const planPayload = parseJson(planned.stdout, 'scan planner output', planned);
if (planPayload.decision.decision !== 'allow_plan') fail('Expected allow_plan decision.', planned);

const dryRun = cp.spawnSync(process.execPath, [DRY_RUN, path.join(planDir, 'operator-scan-plan.json'), '--out', receiptPath], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (dryRun.status !== 0) fail(`Expected scan dry-run success, got ${dryRun.status}`, dryRun);
const receipt = parseJson(dryRun.stdout, 'scan dry-run receipt', dryRun);

if (receipt.networkAccessAttempted !== false) fail('Expected networkAccessAttempted=false.', dryRun);
if (receipt.scanExecutionAllowed !== false || receipt.scanExecutionPerformed !== false) fail('Expected scan execution disabled.', dryRun);
if (!Array.isArray(receipt.intendedSteps) || receipt.intendedSteps.length !== 3) fail(`Expected 3 intended steps, got ${receipt.intendedSteps.length}.`, dryRun);
for (const step of receipt.intendedSteps) {
  if (step.executionStatus !== 'not_executed') fail('Expected step not_executed status.', dryRun);
  if (step.networkAccessAttempted !== false) fail('Expected step networkAccessAttempted=false.', dryRun);
}
if (!receipt.intendedSteps.some((step) => step.method === 'dns_lookup')) fail('Expected dns_lookup dry-run step.', dryRun);
if (!receipt.intendedSteps.some((step) => step.method === 'http_head')) fail('Expected http_head dry-run step.', dryRun);
if (!fs.existsSync(receiptPath)) fail('Expected dry-run receipt artifact.', dryRun);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Operator scan dry-run tests passed.');
