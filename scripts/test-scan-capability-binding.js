#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRAPPER = path.join(ROOT, 'scripts', 'plan-operator-scan-with-capability.js');
const LIVE_READONLY_TEST = path.join(ROOT, 'scripts', 'test-live-readonly-scan-executor.js');
const LIVE_RESULT_BRIDGE_TEST = path.join(ROOT, 'scripts', 'test-live-readonly-scan-result-bridge.js');
const REQUEST = path.join(ROOT, 'examples', 'scope-d', 'operator-scan-request.example.json');
const POLICY = path.join(ROOT, 'examples', 'scope-d', 'operator-scan-policy.example.json');
const VALID_GATE = path.join(ROOT, 'examples', 'scope-d', 'operator-capability-gate.live-readonly.example.json');
const INVALID_GATE = path.join(ROOT, 'fixtures', 'invalid', 'operator-capability-gate-high-risk-enabled.invalid.json');

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

const liveReadOnly = cp.spawnSync(process.execPath, [LIVE_READONLY_TEST], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (liveReadOnly.status !== 0) fail(`Expected live read-only scan executor tests success, got ${liveReadOnly.status}`, liveReadOnly);

const liveResultBridge = cp.spawnSync(process.execPath, [LIVE_RESULT_BRIDGE_TEST], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (liveResultBridge.status !== 0) fail(`Expected live read-only scan result bridge tests success, got ${liveResultBridge.status}`, liveResultBridge);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-capability-binding-'));
const allowDir = path.join(tmpDir, 'allow');
const blockDir = path.join(tmpDir, 'block');

const allowed = cp.spawnSync(process.execPath, [
  WRAPPER,
  '--request', REQUEST,
  '--policy', POLICY,
  '--gate', VALID_GATE,
  '--out-dir', allowDir,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (allowed.status !== 0) fail(`Expected capability-bound planning success, got ${allowed.status}`, allowed);
const allowedPayload = parseJson(allowed.stdout, 'allowed capability planning output', allowed);
if (allowedPayload.capabilityDecision.decision !== 'allow_mode') fail('Expected allow_mode capability decision.', allowed);
if (allowedPayload.capabilityDecision.executionEnabled !== false || allowedPayload.capabilityDecision.executionPerformed !== false) fail('Expected capability execution flags false.', allowed);
if (!allowedPayload.scanPlan || allowedPayload.scanPlan.decision.decision !== 'allow_plan') fail('Expected allow_plan scan decision.', allowed);
if (!fs.existsSync(path.join(allowDir, 'operator-capability-gate-decision.json'))) fail('Expected capability decision artifact.', allowed);
if (!fs.existsSync(path.join(allowDir, 'operator-scan-plan.json'))) fail('Expected scan plan artifact.', allowed);

const blocked = cp.spawnSync(process.execPath, [
  WRAPPER,
  '--request', REQUEST,
  '--policy', POLICY,
  '--gate', INVALID_GATE,
  '--out-dir', blockDir,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (blocked.status !== 2) fail(`Expected blocked capability planning exit 2, got ${blocked.status}`, blocked);
const blockedPayload = parseJson(blocked.stdout, 'blocked capability planning output', blocked);
if (blockedPayload.capabilityDecision.decision !== 'hard_block') fail('Expected hard_block capability decision.', blocked);
if (blockedPayload.scanPlan !== null) fail('Expected no scan plan for blocked capability decision.', blocked);
if (!fs.existsSync(path.join(blockDir, 'operator-capability-gate-decision.json'))) fail('Expected blocked capability decision artifact.', blocked);
if (fs.existsSync(path.join(blockDir, 'operator-scan-plan.json'))) fail('Blocked capability decision must not emit scan plan.', blocked);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Scan capability binding tests passed.');
