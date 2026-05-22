#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRAPPER = path.join(ROOT, 'scripts', 'plan-operator-scan-with-capability.js');
const RUNNER = path.join(ROOT, 'scripts', 'run-live-readonly-scan.js');
const REQUEST = path.join(ROOT, 'examples', 'scope-d', 'operator-scan-request.example.json');
const POLICY = path.join(ROOT, 'examples', 'scope-d', 'operator-scan-policy.example.json');
const GATE = path.join(ROOT, 'examples', 'scope-d', 'operator-capability-gate.live-readonly.example.json');
const SOURCE = path.join(ROOT, 'fixtures', 'synthetic', 'operator-local-passive-scan-source.web-endpoint.synthetic.json');

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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-live-readonly-scan-'));
const planDir = path.join(tmpDir, 'plan');
const receiptPath = path.join(tmpDir, 'live-readonly-receipt.json');

const planned = cp.spawnSync(process.execPath, [
  WRAPPER,
  '--request', REQUEST,
  '--policy', POLICY,
  '--gate', GATE,
  '--out-dir', planDir,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (planned.status !== 0) fail(`Expected capability-bound scan planning success, got ${planned.status}`, planned);
const planPayload = parseJson(planned.stdout, 'capability-bound scan plan', planned);
if (planPayload.capabilityDecision.decision !== 'allow_mode') fail('Expected capability allow_mode.', planned);
if (!planPayload.scanPlan || planPayload.scanPlan.decision.decision !== 'allow_plan') fail('Expected scan allow_plan.', planned);

const mock = cp.spawnSync(process.execPath, [
  RUNNER,
  '--plan', path.join(planDir, 'operator-scan-plan.json'),
  '--capability-decision', path.join(planDir, 'operator-capability-gate-decision.json'),
  '--mode', 'mock_live_readonly',
  '--mock-source', SOURCE,
  '--out', receiptPath,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (mock.status !== 0) fail(`Expected mock live-read-only success, got ${mock.status}`, mock);
const receipt = parseJson(mock.stdout, 'mock live-read-only receipt', mock);
if (receipt.mode !== 'mock_live_readonly') fail('Expected mock_live_readonly mode.', mock);
if (receipt.networkAccessAttempted !== false) fail('Expected mock networkAccessAttempted=false.', mock);
if (receipt.liveReadOnlyPerformed !== false) fail('Expected mock liveReadOnlyPerformed=false.', mock);
if (receipt.credentialAccessAttempted !== false || receipt.payloadDeliveryAttempted !== false || receipt.mutationAttempted !== false || receipt.destructiveBehaviorAttempted !== false) fail('Expected high-risk attempt flags false.', mock);
if (!Array.isArray(receipt.observations) || receipt.observations.length !== 3) fail(`Expected 3 mock observations, got ${receipt.observations.length}.`, mock);
if (!fs.existsSync(receiptPath)) fail('Expected receipt artifact.', mock);

const blockedLive = cp.spawnSync(process.execPath, [
  RUNNER,
  '--plan', path.join(planDir, 'operator-scan-plan.json'),
  '--capability-decision', path.join(planDir, 'operator-capability-gate-decision.json'),
  '--mode', 'live_readonly',
  '--out', path.join(tmpDir, 'blocked-live-receipt.json'),
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, SCOPE_D_ENABLE_LIVE_READONLY: '' } });
if (blockedLive.status === 0) fail('Expected live_readonly without env gate to fail.', blockedLive);
if (!blockedLive.stderr.includes('SCOPE_D_ENABLE_LIVE_READONLY=1')) fail('Expected explicit live-readonly env gate error.', blockedLive);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Live read-only scan executor tests passed.');
