#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RUNNER = path.join(ROOT, 'scripts', 'run-scan-assurance.js');
const MANIFEST_TEST = path.join(ROOT, 'scripts', 'test-run-manifest.js');
const PACKAGE_TEST = path.join(ROOT, 'scripts', 'test-client-evidence-package.js');
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
  try { return JSON.parse(text); } catch (err) { fail(`${label}: expected JSON: ${err.message}`, result); }
}

function assertCommonRun(index, expectedMode, expectedClient, result) {
  if (index.clientRef !== expectedClient) fail('Unexpected clientRef.', result);
  if (index.mode !== expectedMode) fail(`Expected mode=${expectedMode}, got ${index.mode}.`, result);
  if (index.networkAccessAttempted !== false) fail('Expected networkAccessAttempted=false.', result);
  if (index.scanExecutionPerformed !== false) fail('Expected scanExecutionPerformed=false.', result);
  if (index.executionAllowed !== false || index.executionPerformed !== false) fail('Expected execution flags false.', result);
}

function assertArtifacts(root, expectedSourceName, expectedReceiptPresent, result) {
  const required = [
    'operator-scan-assurance-run.json',
    'operator-scan-policy.json',
    'operator-scan-request.json',
    expectedSourceName,
    'operator-scan-result.json',
    'operator-scan-result-assessment.json',
    path.join('plan', 'operator-scan-plan.json'),
    path.join('surface', 'surface-run-index.json'),
    path.join('operator', 'operator-workflow-run.json'),
    path.join('operator', 'operator-workorder.json'),
    path.join('operator', 'operator-workorders.json'),
    path.join('operator', 'case', 'case-index.json'),
    path.join('dashboard', 'operator-dashboard.json'),
    path.join('client-report', 'client-assurance-report.json'),
  ];
  if (expectedReceiptPresent) required.push('operator-live-readonly-scan-receipt.json');
  for (const file of required) {
    if (!fs.existsSync(path.join(root, file))) fail(`Missing expected artifact ${file}.`, result);
  }
}

function assertClientReport(root, expectedClient, result) {
  const surfaceIndex = parseJson(fs.readFileSync(path.join(root, 'surface', 'surface-run-index.json'), 'utf8'), 'surface index', result);
  if (surfaceIndex.surfaceKind !== 'web_endpoint') fail('Expected web_endpoint surface.', result);
  if (surfaceIndex.executionPerformed !== false) fail('Expected surface executionPerformed=false.', result);

  const clientReport = parseJson(fs.readFileSync(path.join(root, 'client-report', 'client-assurance-report.json'), 'utf8'), 'client report', result);
  if (clientReport.clientRef !== expectedClient) fail('Unexpected client report clientRef.', result);
  if (clientReport.executionPerformed !== false) fail('Expected client report executionPerformed=false.', result);
  if (!clientReport.recommendedActions.some((action) => action.sourcePlaybookId === 'operator-playbook:scan-result-response')) fail('Expected scan response recommended action.', result);
}

function runAssurance(label, args, expectedStatus, env) {
  const result = cp.spawnSync(process.execPath, [RUNNER, ...args], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', env: env || process.env });
  if (result.status !== expectedStatus) fail(`Expected ${label} status ${expectedStatus}, got ${result.status}`, result);
  return result;
}

const manifest = cp.spawnSync(process.execPath, [MANIFEST_TEST], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (manifest.status !== 0) fail(`Expected run manifest tests success, got ${manifest.status}`, manifest);

const pkg = cp.spawnSync(process.execPath, [PACKAGE_TEST], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (pkg.status !== 0) fail(`Expected client evidence package tests success, got ${pkg.status}`, pkg);

const localDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-scan-assurance-local-'));
fs.rmSync(localDir, { recursive: true, force: true });
const local = runAssurance('local passive scan assurance', [
  '--request', REQUEST,
  '--policy', POLICY,
  '--source', SOURCE,
  '--client', 'client:synthetic-scan-assurance',
  '--mode', 'local_passive',
  '--run-id', 'operator-scan-assurance-run:ci-scan-assurance-local',
  '--out-dir', localDir,
], 0);
const localIndex = parseJson(local.stdout, 'local scan assurance index', local);
if (localIndex.runId !== 'operator-scan-assurance-run:ci-scan-assurance-local') fail('Unexpected local runId.', local);
assertCommonRun(localIndex, 'local_passive', 'client:synthetic-scan-assurance', local);
if (localIndex.liveReadOnlyReceiptRef !== null) fail('Expected no liveReadOnlyReceiptRef for local_passive mode.', local);
assertArtifacts(localDir, 'local-passive-source.json', false, local);
assertClientReport(localDir, 'client:synthetic-scan-assurance', local);
fs.rmSync(localDir, { recursive: true, force: true });

const mockDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-scan-assurance-mock-live-'));
fs.rmSync(mockDir, { recursive: true, force: true });
const mock = runAssurance('mock live-readonly scan assurance', [
  '--request', REQUEST,
  '--policy', POLICY,
  '--source', SOURCE,
  '--client', 'client:synthetic-live-readonly-assurance',
  '--mode', 'mock_live_readonly',
  '--gate', GATE,
  '--run-id', 'operator-scan-assurance-run:ci-scan-assurance-mock-live',
  '--out-dir', mockDir,
], 0);
const mockIndex = parseJson(mock.stdout, 'mock live-readonly assurance index', mock);
if (mockIndex.runId !== 'operator-scan-assurance-run:ci-scan-assurance-mock-live') fail('Unexpected mock runId.', mock);
assertCommonRun(mockIndex, 'mock_live_readonly', 'client:synthetic-live-readonly-assurance', mock);
if (!mockIndex.liveReadOnlyReceiptRef) fail('Expected liveReadOnlyReceiptRef for mock_live_readonly mode.', mock);
assertArtifacts(mockDir, 'live-readonly-source.json', true, mock);
assertClientReport(mockDir, 'client:synthetic-live-readonly-assurance', mock);
fs.rmSync(mockDir, { recursive: true, force: true });

const blockedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-scan-assurance-live-blocked-'));
fs.rmSync(blockedDir, { recursive: true, force: true });
const blocked = runAssurance('blocked live-readonly scan assurance', [
  '--request', REQUEST,
  '--policy', POLICY,
  '--source', SOURCE,
  '--client', 'client:blocked-live-readonly-assurance',
  '--mode', 'live_readonly',
  '--gate', GATE,
  '--run-id', 'operator-scan-assurance-run:ci-scan-assurance-live-blocked',
  '--out-dir', blockedDir,
], 1, { ...process.env, SCOPE_D_ENABLE_LIVE_READONLY: '' });
if (!blocked.stderr.includes('SCOPE_D_ENABLE_LIVE_READONLY=1')) fail('Expected explicit live-readonly environment gate failure.', blocked);
fs.rmSync(blockedDir, { recursive: true, force: true });

console.log('Scan assurance runner tests passed.');
