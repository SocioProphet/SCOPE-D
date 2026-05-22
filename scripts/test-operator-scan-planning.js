#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PLANNER = path.join(ROOT, 'scripts', 'plan-operator-scan.js');
const VALID_REQUEST = path.join(ROOT, 'examples', 'scope-d', 'operator-scan-request.example.json');
const BLOCKED_REQUEST = path.join(ROOT, 'fixtures', 'invalid', 'operator-scan-request-exploit.invalid.json');
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-scan-plan-'));
const allowDir = path.join(tmpDir, 'allow');
const blockDir = path.join(tmpDir, 'block');

const allowed = cp.spawnSync(process.execPath, [PLANNER, VALID_REQUEST, '--policy', POLICY, '--out-dir', allowDir], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (allowed.status !== 0) fail(`Expected allowed scan plan success, got ${allowed.status}`, allowed);
const allowedPayload = parseJson(allowed.stdout, 'allowed scan planner output', allowed);
if (allowedPayload.decision.decision !== 'allow_plan') fail('Expected allow_plan decision.', allowed);
if (allowedPayload.decision.scanExecutionAllowed !== false || allowedPayload.decision.scanExecutionPerformed !== false) fail('Expected scan execution disabled in decision.', allowed);
if (!allowedPayload.planRef) fail('Expected planRef for allowed request.', allowed);
for (const file of ['operator-scan-decision.json', 'operator-scan-plan.json']) {
  if (!fs.existsSync(path.join(allowDir, file))) fail(`Expected ${file} in allow dir.`, allowed);
}
const plan = parseJson(fs.readFileSync(path.join(allowDir, 'operator-scan-plan.json'), 'utf8'), 'scan plan file', allowed);
if (plan.scanExecutionAllowed !== false || plan.scanExecutionPerformed !== false) fail('Expected scan execution disabled in plan.', allowed);
if (!plan.plannedMethods.includes('dns_lookup') || !plan.plannedMethods.includes('http_head')) fail('Expected planned read methods.', allowed);

const blocked = cp.spawnSync(process.execPath, [PLANNER, BLOCKED_REQUEST, '--policy', POLICY, '--out-dir', blockDir], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (blocked.status !== 2) fail(`Expected blocked scan exit 2, got ${blocked.status}`, blocked);
const blockedPayload = parseJson(blocked.stdout, 'blocked scan planner output', blocked);
if (blockedPayload.decision.decision !== 'hard_block') fail('Expected hard_block decision.', blocked);
if (!blockedPayload.decision.blockedMethods.includes('exploit_attempt')) fail('Expected exploit_attempt block.', blocked);
if (blockedPayload.planRef !== null) fail('Expected no planRef for blocked request.', blocked);
if (!fs.existsSync(path.join(blockDir, 'operator-scan-decision.json'))) fail('Expected blocked decision artifact.', blocked);
if (fs.existsSync(path.join(blockDir, 'operator-scan-plan.json'))) fail('Blocked request must not emit a plan.', blocked);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Operator scan planning tests passed.');
