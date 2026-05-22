#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PLANNER = path.join(ROOT, 'scripts', 'plan-batch-scan.js');
const BATCH = path.join(ROOT, 'examples', 'scope-d', 'scan-target-batch.example.json');
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-batch-scan-'));
const mixedDir = path.join(tmpDir, 'mixed');
const wholeDir = path.join(tmpDir, 'whole');
const wholeBatchPath = path.join(tmpDir, 'scan-target-batch.block-entire.json');

const mixed = cp.spawnSync(process.execPath, [PLANNER, BATCH, '--policy', POLICY, '--out-dir', mixedDir], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: 'pipe',
});
if (mixed.status !== 0) fail(`Expected mixed batch planning success, got ${mixed.status}`, mixed);
const mixedPlan = parseJson(mixed.stdout, 'mixed batch plan', mixed);
if (mixedPlan.targetCount !== 2) fail(`Expected 2 targets, got ${mixedPlan.targetCount}.`, mixed);
if (mixedPlan.allowedCount !== 1) fail(`Expected 1 allowed target, got ${mixedPlan.allowedCount}.`, mixed);
if (mixedPlan.blockedCount !== 1) fail(`Expected 1 blocked target, got ${mixedPlan.blockedCount}.`, mixed);
if (mixedPlan.executionAllowed !== false || mixedPlan.executionPerformed !== false) fail('Expected batch execution flags false.', mixed);
const allowedTarget = mixedPlan.targets.find((target) => target.targetRef === 'example.com');
const blockedTarget = mixedPlan.targets.find((target) => target.targetRef === 'unauthorized.example.net');
if (!allowedTarget || allowedTarget.status !== 'allow_plan' || !allowedTarget.planRef) fail('Expected example.com allow_plan with planRef.', mixed);
if (!blockedTarget || blockedTarget.status !== 'hard_block' || blockedTarget.planRef !== null) fail('Expected unauthorized target hard_block without planRef.', mixed);
if (!blockedTarget.blockedMethods.includes('target_not_authorized')) fail('Expected target_not_authorized block.', mixed);
for (const target of mixedPlan.targets) {
  if (!fs.existsSync(path.join(ROOT, target.requestRef))) fail(`Missing request artifact ${target.requestRef}.`, mixed);
  if (!fs.existsSync(path.join(ROOT, target.decisionRef))) fail(`Missing decision artifact ${target.decisionRef}.`, mixed);
}
if (!fs.existsSync(path.join(mixedDir, 'scan-target-batch-plan.json'))) fail('Expected mixed batch plan artifact.', mixed);

const wholeBatch = JSON.parse(fs.readFileSync(BATCH, 'utf8'));
wholeBatch.batchId = 'scan-target-batch:example-web-targets-block-entire';
wholeBatch.batchFailureMode = 'block_entire_batch';
fs.writeFileSync(wholeBatchPath, `${JSON.stringify(wholeBatch, null, 2)}\n`, 'utf8');
const whole = cp.spawnSync(process.execPath, [PLANNER, wholeBatchPath, '--policy', POLICY, '--out-dir', wholeDir], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: 'pipe',
});
if (whole.status !== 0) fail(`Expected whole-batch planning success, got ${whole.status}`, whole);
const wholePlan = parseJson(whole.stdout, 'whole batch plan', whole);
if (wholePlan.targetCount !== 2) fail(`Expected 2 whole-batch targets, got ${wholePlan.targetCount}.`, whole);
if (wholePlan.allowedCount !== 0) fail(`Expected 0 allowed targets after whole-batch block, got ${wholePlan.allowedCount}.`, whole);
if (wholePlan.blockedCount !== 2) fail(`Expected 2 blocked targets after whole-batch block, got ${wholePlan.blockedCount}.`, whole);
if (!wholePlan.targets.some((target) => target.blockedMethods.includes('batch_blocked_due_to_invalid_target'))) fail('Expected whole-batch block marker.', whole);
for (const target of wholePlan.targets) {
  if (target.status !== 'hard_block') fail('Expected every whole-batch target to be hard_block.', whole);
  if (target.planRef !== null) fail('Expected whole-batch blocked targets to have null planRef.', whole);
}

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Batch scan planning tests passed.');
