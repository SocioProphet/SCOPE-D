#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const VALID_POLICY = 'examples/scope-d/engagement-policy.synthetic.json';

function runNodeScript(scriptName, args) {
  return childProcess.spawnSync(process.execPath, [path.join(ROOT, 'scripts', scriptName), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function rmRun(runId) {
  const runDir = path.join(ROOT, 'runs', runId);
  if (fs.existsSync(runDir)) fs.rmSync(runDir, { recursive: true, force: true });
}

function combined(result) {
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

function fail(message, result) {
  console.error(message);
  if (result) {
    if (result.stdout) console.error(result.stdout.trim());
    if (result.stderr) console.error(result.stderr.trim());
  }
  process.exit(1);
}

function expectSuccess(label, result) {
  if (result.status !== 0) fail(`Expected success for ${label}.`, result);
}

function expectFailure(label, result, expectedText) {
  if (result.status === 0) fail(`Expected failure for ${label}, but command succeeded.`, result);
  const out = combined(result);
  if (expectedText && !out.includes(expectedText)) {
    fail(`Expected failure for ${label} to include ${expectedText}, but got:\n${out}`, result);
  }
}

function runInit(args) {
  return runNodeScript('init-run.js', args);
}

function main() {
  const validRunId = 'scope-d-ci-engagement-valid';
  rmRun(validRunId);

  const valid = runInit([
    '--run-id', validRunId,
    '--target', 'ci-engagement-valid',
    '--engagement-policy', VALID_POLICY,
  ]);
  expectSuccess('valid engagement policy', valid);

  const verify = runNodeScript('verify-run.js', [`runs/${validRunId}`]);
  expectSuccess('verification after valid engagement policy run', verify);

  const missingPolicy = runInit([
    '--run-id', 'scope-d-ci-engagement-missing-policy',
    '--target', 'ci-engagement-valid',
  ]);
  expectFailure('missing engagement policy argument', missingPolicy, 'FAIL-CLOSED: --engagement-policy is required');

  const missingFile = runInit([
    '--run-id', 'scope-d-ci-engagement-missing-file',
    '--target', 'ci-engagement-valid',
    '--engagement-policy', 'fixtures/invalid/does-not-exist.json',
  ]);
  expectFailure('missing engagement policy file', missingFile, 'FAIL-CLOSED: Could not load engagement policy');

  const liveNoMichael = runInit([
    '--run-id', 'scope-d-ci-engagement-live-no-michael',
    '--target', 'owned-lab-target',
    '--engagement-policy', 'fixtures/invalid/engagement-policy-live-engage-no-michael.invalid.json',
  ]);
  expectFailure('live_engage without Michael approval requirement', liveNoMichael, 'FAIL-CLOSED: Engagement policy');

  const emptyTargets = runInit([
    '--run-id', 'scope-d-ci-engagement-empty-targets',
    '--target', 'ci-engagement-valid',
    '--engagement-policy', 'fixtures/invalid/engagement-policy-empty-targets.invalid.json',
  ]);
  expectFailure('empty authorizedTargets', emptyTargets, 'is not authorized by the loaded engagement policy');

  const unauthorizedTarget = runInit([
    '--run-id', 'scope-d-ci-engagement-unauthorized-target',
    '--target', 'not-authorized-target',
    '--engagement-policy', VALID_POLICY,
  ]);
  expectFailure('unauthorized target', unauthorizedTarget, 'Target "not-authorized-target" / surface "synthetic_lab" / mode "synthetic_only" is not authorized');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-engagement-policy-'));
  const dryRunOnlyPath = path.join(tmpDir, 'dry-run-only.json');
  const dryRunOnly = JSON.parse(fs.readFileSync(path.join(ROOT, VALID_POLICY), 'utf8'));
  dryRunOnly.policyId = 'engagement-policy-dry-run-only-invalid-for-init';
  dryRunOnly.name = 'Dry-run-only policy that does not authorize scope-d:init synthetic mode';
  dryRunOnly.authorizedModes = ['dry_run'];
  fs.writeFileSync(dryRunOnlyPath, `${JSON.stringify(dryRunOnly, null, 2)}\n`, 'utf8');

  const unauthorizedMode = runInit([
    '--run-id', 'scope-d-ci-engagement-unauthorized-mode',
    '--target', 'ci-engagement-valid',
    '--engagement-policy', dryRunOnlyPath,
  ]);
  expectFailure('unauthorized mode', unauthorizedMode, 'mode "synthetic_only" is not authorized');

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('Engagement policy fail-closed tests passed.');
}

main();
