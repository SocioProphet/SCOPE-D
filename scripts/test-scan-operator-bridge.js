#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PLANNER = path.join(ROOT, 'scripts', 'plan-operator-scan.js');
const LOCAL_SCAN = path.join(ROOT, 'scripts', 'run-local-passive-scan.js');
const INGEST = path.join(ROOT, 'scripts', 'ingest-operator-scan-result.js');
const BRIDGE = path.join(ROOT, 'scripts', 'bridge-scan-assessment-to-surface.js');
const INTAKE = path.join(ROOT, 'scripts', 'operator-intake.js');
const WORKORDERS = path.join(ROOT, 'scripts', 'generate-operator-workorders.js');
const CASE = path.join(ROOT, 'scripts', 'build-operator-case.js');
const DASHBOARD = path.join(ROOT, 'scripts', 'export-operator-dashboard.js');
const CLIENT_REPORT = path.join(ROOT, 'scripts', 'export-client-assurance-report.js');

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

function run(label, args) {
  const result = cp.spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) fail(`${label} failed with ${result.status}`, result);
  return result;
}

function parseJson(text, label, result) {
  try { return JSON.parse(text); } catch (err) { fail(`${label}: expected JSON: ${err.message}`, result); }
}

const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-scan-bridge-'));
fs.rmSync(rootDir, { recursive: true, force: true });
const planDir = path.join(rootDir, 'plan');
const scanResultPath = path.join(rootDir, 'operator-scan-result.json');
const scanAssessmentPath = path.join(rootDir, 'operator-scan-result-assessment.json');
const surfaceDir = path.join(rootDir, 'surface');
const operatorDir = path.join(rootDir, 'operator');
const caseDir = path.join(operatorDir, 'case');
const dashboardDir = path.join(rootDir, 'dashboard');
const clientDir = path.join(rootDir, 'client-report');

run('scan plan', [PLANNER, REQUEST, '--policy', POLICY, '--out-dir', planDir]);
run('local passive scan', [LOCAL_SCAN, '--plan', path.join(planDir, 'operator-scan-plan.json'), '--source', SOURCE, '--out', scanResultPath]);

const ingested = run('scan result ingestion', [INGEST, scanResultPath, '--out', scanAssessmentPath]);
const scanAssessment = parseJson(ingested.stdout, 'scan assessment', ingested);
if (scanAssessment.surfaceKind !== 'web_endpoint') fail('Expected web_endpoint scan assessment.', ingested);
if (scanAssessment.networkAccessAttempted !== false || scanAssessment.scanExecutionPerformed !== false) fail('Expected scan assessment execution flags false.', ingested);

const bridged = run('scan surface bridge', [BRIDGE, scanAssessmentPath, '--out-dir', surfaceDir, '--run-id', 'scope-d-surface-ci-scan-web-endpoint']);
const surfaceIndex = parseJson(bridged.stdout, 'surface index', bridged);
if (surfaceIndex.surfaceKind !== 'web_endpoint') fail('Expected web_endpoint surface index.', bridged);
if (surfaceIndex.executionPerformed !== false) fail('Expected surface index executionPerformed=false.', bridged);

run('operator intake', [INTAKE, path.join(surfaceDir, 'surface-run-index.json'), '--out-dir', operatorDir]);
run('operator workorders', [WORKORDERS, path.join(operatorDir, 'operator-workorder.json'), '--out-dir', operatorDir]);
run('operator case', [CASE, path.join(operatorDir, 'operator-workorders.json'), '--source-workorder', path.join(operatorDir, 'operator-workorder.json'), '--out-dir', caseDir]);
run('operator dashboard', [DASHBOARD, '--case', path.join(caseDir, 'case-index.json'), '--out-dir', dashboardDir]);
run('client report', [CLIENT_REPORT, '--dashboard', path.join(dashboardDir, 'operator-dashboard.json'), '--client', 'client:synthetic-scan', '--case', path.join(caseDir, 'case-index.json'), '--out-dir', clientDir]);

const workorders = parseJson(fs.readFileSync(path.join(operatorDir, 'operator-workorders.json'), 'utf8'), 'operator workorders');
const playbookIds = new Set(workorders.workorders[0].mappedPlaybooks.map((item) => item.playbookId));
if (!playbookIds.has('operator-playbook:scan-result-response')) fail('Expected scan-result-response playbook mapping.');

const caseIndex = parseJson(fs.readFileSync(path.join(caseDir, 'case-index.json'), 'utf8'), 'case index');
if (caseIndex.surfaceKind !== 'web_endpoint') fail('Expected web_endpoint case.');
if (caseIndex.executionPerformed !== false) fail('Expected case executionPerformed=false.');

const clientReport = parseJson(fs.readFileSync(path.join(clientDir, 'client-assurance-report.json'), 'utf8'), 'client report');
if (clientReport.clientRef !== 'client:synthetic-scan') fail('Unexpected client report clientRef.');
if (clientReport.executionPerformed !== false) fail('Expected client report executionPerformed=false.');
if (!clientReport.recommendedActions.some((action) => action.sourcePlaybookId === 'operator-playbook:scan-result-response')) fail('Expected scan playbook recommended action.');

for (const file of [
  path.join(surfaceDir, 'surface-run-index.json'),
  path.join(operatorDir, 'operator-workflow-run.json'),
  path.join(operatorDir, 'operator-workorder.json'),
  path.join(operatorDir, 'operator-workorders.json'),
  path.join(caseDir, 'case-index.json'),
  path.join(dashboardDir, 'operator-dashboard.json'),
  path.join(clientDir, 'client-assurance-report.json')
]) {
  if (!fs.existsSync(file)) fail(`Missing expected artifact ${file}.`);
}

fs.rmSync(rootDir, { recursive: true, force: true });
console.log('Scan operator bridge tests passed.');
