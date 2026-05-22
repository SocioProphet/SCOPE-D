#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RUNNER = path.join(ROOT, 'scripts', 'run-scan-assurance.js');
const REQUEST = path.join(ROOT, 'examples', 'scope-d', 'operator-scan-request.example.json');
const POLICY = path.join(ROOT, 'examples', 'scope-d', 'operator-scan-policy.example.json');
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-scan-assurance-'));
fs.rmSync(tmpDir, { recursive: true, force: true });

const result = cp.spawnSync(process.execPath, [
  RUNNER,
  '--request', REQUEST,
  '--policy', POLICY,
  '--source', SOURCE,
  '--client', 'client:synthetic-scan-assurance',
  '--run-id', 'operator-scan-assurance-run:ci-scan-assurance',
  '--out-dir', tmpDir,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });

if (result.status !== 0) fail(`Expected scan assurance runner success, got ${result.status}`, result);
const index = parseJson(result.stdout, 'scan assurance index', result);

if (index.runId !== 'operator-scan-assurance-run:ci-scan-assurance') fail('Unexpected runId.', result);
if (index.clientRef !== 'client:synthetic-scan-assurance') fail('Unexpected clientRef.', result);
if (index.networkAccessAttempted !== false) fail('Expected networkAccessAttempted=false.', result);
if (index.scanExecutionPerformed !== false) fail('Expected scanExecutionPerformed=false.', result);
if (index.executionAllowed !== false || index.executionPerformed !== false) fail('Expected execution flags false.', result);

for (const file of [
  'operator-scan-assurance-run.json',
  'operator-scan-policy.json',
  'operator-scan-request.json',
  'local-passive-source.json',
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
]) {
  if (!fs.existsSync(path.join(tmpDir, file))) fail(`Missing expected artifact ${file}.`, result);
}

const surfaceIndex = parseJson(fs.readFileSync(path.join(tmpDir, 'surface', 'surface-run-index.json'), 'utf8'), 'surface index', result);
if (surfaceIndex.surfaceKind !== 'web_endpoint') fail('Expected web_endpoint surface.', result);
if (surfaceIndex.executionPerformed !== false) fail('Expected surface executionPerformed=false.', result);

const clientReport = parseJson(fs.readFileSync(path.join(tmpDir, 'client-report', 'client-assurance-report.json'), 'utf8'), 'client report', result);
if (clientReport.clientRef !== 'client:synthetic-scan-assurance') fail('Unexpected client report clientRef.', result);
if (clientReport.executionPerformed !== false) fail('Expected client report executionPerformed=false.', result);
if (!clientReport.recommendedActions.some((action) => action.sourcePlaybookId === 'operator-playbook:scan-result-response')) fail('Expected scan response recommended action.', result);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Scan assurance runner tests passed.');
