#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRAPPER = path.join(ROOT, 'scripts', 'plan-operator-scan-with-capability.js');
const LIVE_RUNNER = path.join(ROOT, 'scripts', 'run-live-readonly-scan.js');
const BRIDGE = path.join(ROOT, 'scripts', 'bridge-live-readonly-receipt-to-result.js');
const INGEST = path.join(ROOT, 'scripts', 'ingest-operator-scan-result.js');
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-live-result-bridge-'));
fs.rmSync(tmpDir, { recursive: true, force: true });
const planDir = path.join(tmpDir, 'plan');
const receiptPath = path.join(tmpDir, 'live-readonly-receipt.json');
const resultPath = path.join(tmpDir, 'operator-scan-result.json');
const assessmentPath = path.join(tmpDir, 'operator-scan-result-assessment.json');

const planned = cp.spawnSync(process.execPath, [
  WRAPPER,
  '--request', REQUEST,
  '--policy', POLICY,
  '--gate', GATE,
  '--out-dir', planDir,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (planned.status !== 0) fail(`Expected capability-bound scan planning success, got ${planned.status}`, planned);
const plannedPayload = parseJson(planned.stdout, 'capability-bound plan', planned);
if (plannedPayload.capabilityDecision.decision !== 'allow_mode') fail('Expected allow_mode capability decision.', planned);
if (!plannedPayload.scanPlan || plannedPayload.scanPlan.decision.decision !== 'allow_plan') fail('Expected allow_plan scan decision.', planned);

const receiptRun = cp.spawnSync(process.execPath, [
  LIVE_RUNNER,
  '--plan', path.join(planDir, 'operator-scan-plan.json'),
  '--capability-decision', path.join(planDir, 'operator-capability-gate-decision.json'),
  '--mode', 'mock_live_readonly',
  '--mock-source', SOURCE,
  '--out', receiptPath,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (receiptRun.status !== 0) fail(`Expected mock live-readonly receipt success, got ${receiptRun.status}`, receiptRun);
const receipt = parseJson(receiptRun.stdout, 'live-readonly receipt', receiptRun);
if (receipt.networkAccessAttempted !== false || receipt.liveReadOnlyPerformed !== false) fail('Expected mock receipt network/live flags false.', receiptRun);
if (receipt.credentialAccessAttempted !== false || receipt.payloadDeliveryAttempted !== false || receipt.mutationAttempted !== false || receipt.destructiveBehaviorAttempted !== false) fail('Expected high-risk receipt flags false.', receiptRun);

const bridged = cp.spawnSync(process.execPath, [
  BRIDGE,
  receiptPath,
  '--policy', POLICY,
  '--request', REQUEST,
  '--decision', path.join(planDir, 'operator-scan-decision.json'),
  '--out', resultPath,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (bridged.status !== 0) fail(`Expected receipt-to-result bridge success, got ${bridged.status}`, bridged);
const scanResult = parseJson(bridged.stdout, 'scan result', bridged);
if (scanResult.resultSource !== 'fixture') fail(`Expected fixture resultSource for mock mode, got ${scanResult.resultSource}.`, bridged);
if (scanResult.networkAccessAttempted !== false || scanResult.scanExecutionPerformed !== false) fail('Expected bridged scan result execution flags false.', bridged);
if (scanResult.credentialAccessAttempted !== false || scanResult.payloadDeliveryAttempted !== false || scanResult.mutationAttempted !== false) fail('Expected bridged high-risk flags false.', bridged);
if (scanResult.observations.length !== 3) fail(`Expected 3 scan observations, got ${scanResult.observations.length}.`, bridged);
if (!fs.existsSync(resultPath)) fail('Expected bridged scan result artifact.', bridged);

const ingested = cp.spawnSync(process.execPath, [INGEST, resultPath, '--out', assessmentPath], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (ingested.status !== 0) fail(`Expected bridged scan result ingestion success, got ${ingested.status}`, ingested);
const assessment = parseJson(ingested.stdout, 'scan result assessment', ingested);
if (assessment.surfaceKind !== 'web_endpoint') fail('Expected web_endpoint assessment.', ingested);
if (assessment.findingCount !== 2) fail(`Expected 2 findings, got ${assessment.findingCount}.`, ingested);
if (assessment.networkAccessAttempted !== false || assessment.scanExecutionPerformed !== false) fail('Expected assessment execution flags false.', ingested);

const liveBlocked = cp.spawnSync(process.execPath, [
  LIVE_RUNNER,
  '--plan', path.join(planDir, 'operator-scan-plan.json'),
  '--capability-decision', path.join(planDir, 'operator-capability-gate-decision.json'),
  '--mode', 'live_readonly',
  '--out', path.join(tmpDir, 'blocked-live-receipt.json'),
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, SCOPE_D_ENABLE_LIVE_READONLY: '' } });
if (liveBlocked.status === 0) fail('Expected live_readonly mode without env gate to fail.', liveBlocked);
if (!liveBlocked.stderr.includes('SCOPE_D_ENABLE_LIVE_READONLY=1')) fail('Expected explicit env gate failure for live mode.', liveBlocked);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Live read-only scan result bridge tests passed.');
