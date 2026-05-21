#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SURFACE_RUNNER = path.join(ROOT, 'scripts', 'run-surface-assessment.js');
const OPERATOR_INTAKE = path.join(ROOT, 'scripts', 'operator-intake.js');
const WORKORDER_BINDER = path.join(ROOT, 'scripts', 'generate-operator-workorders.js');
const CASE_BUILDER = path.join(ROOT, 'scripts', 'build-operator-case.js');
const REASSESS = path.join(ROOT, 'scripts', 'reassess-surface-case.js');
const DASHBOARD = path.join(ROOT, 'scripts', 'export-operator-dashboard.js');
const ORIGINAL_FIXTURE = path.join(ROOT, 'fixtures', 'synthetic', 'mcp-surface.multi-tool.synthetic.json');
const IMPROVED_FIXTURE = path.join(ROOT, 'fixtures', 'synthetic', 'mcp-surface.improved.synthetic.json');

function fail(message, result) {
  console.error(message);
  if (result) {
    if (result.stdout) console.error(`stdout:\n${result.stdout}`);
    if (result.stderr) console.error(`stderr:\n${result.stderr}`);
  }
  process.exit(1);
}

function parseJson(text, label, result) {
  try {
    return JSON.parse(text);
  } catch (err) {
    fail(`${label}: expected JSON output: ${err.message}`, result);
  }
}

function run(label, args) {
  const result = cp.spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) fail(`${label} failed with ${result.status}`, result);
  return result;
}

const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-dashboard-'));
fs.rmSync(rootDir, { recursive: true, force: true });
const originalDir = path.join(rootDir, 'original');
const improvedDir = path.join(rootDir, 'improved');
const operatorDir = path.join(originalDir, 'operator');
const caseDir = path.join(operatorDir, 'case');
const dashboardDir = path.join(rootDir, 'dashboard');

run('original surface assessment', [
  SURFACE_RUNNER,
  '--surface', 'mcp_surface',
  '--input', ORIGINAL_FIXTURE,
  '--run-id', 'scope-d-surface-ci-dashboard-original',
  '--out-dir', originalDir,
]);
run('operator intake', [OPERATOR_INTAKE, path.join(originalDir, 'surface-run-index.json'), '--out-dir', operatorDir]);
run('workorder binding', [WORKORDER_BINDER, path.join(operatorDir, 'operator-workorder.json'), '--out-dir', operatorDir]);
run('case builder', [CASE_BUILDER, path.join(operatorDir, 'operator-workorders.json'), '--source-workorder', path.join(operatorDir, 'operator-workorder.json'), '--out-dir', caseDir]);
run('improved surface assessment', [
  SURFACE_RUNNER,
  '--surface', 'mcp_surface',
  '--input', IMPROVED_FIXTURE,
  '--run-id', 'scope-d-surface-ci-dashboard-improved',
  '--out-dir', improvedDir,
]);
run('reassessment report', [REASSESS, '--case', path.join(caseDir, 'case-index.json'), '--new-run-index', path.join(improvedDir, 'surface-run-index.json'), '--out-dir', caseDir]);

const dashboardResult = run('operator dashboard export', [
  DASHBOARD,
  '--case', path.join(caseDir, 'case-index.json'),
  '--reassessment', path.join(caseDir, 'reassessment-report.json'),
  '--out-dir', dashboardDir,
]);
const dashboard = parseJson(dashboardResult.stdout, 'operator dashboard', dashboardResult);

if (dashboard.caseCount !== 1) fail('Expected one dashboard case.', dashboardResult);
if (dashboard.openCaseCount !== 1) fail('Expected one open dashboard case.', dashboardResult);
if (dashboard.awaitingApprovalCount !== 1) fail('Expected one awaiting approval case.', dashboardResult);
if (dashboard.criticalCaseCount !== 1) fail('Expected one critical case.', dashboardResult);
if (dashboard.executionAllowed !== false || dashboard.executionPerformed !== false) fail('Expected dashboard execution disabled.', dashboardResult);
if (!Array.isArray(dashboard.riskBySurface) || dashboard.riskBySurface.length !== 1) fail('Expected one surface risk row.', dashboardResult);
if (dashboard.riskBySurface[0].surfaceKind !== 'mcp_surface') fail('Expected MCP surface risk row.', dashboardResult);
if (dashboard.riskBySurface[0].critical !== 1) fail('Expected one critical MCP case.', dashboardResult);
if (!Array.isArray(dashboard.recentReassessments) || dashboard.recentReassessments.length !== 1) fail('Expected one reassessment summary.', dashboardResult);
if (dashboard.recentReassessments[0].outcome !== 'improved') fail('Expected improved reassessment outcome.', dashboardResult);
if (!dashboard.topFindingCategories.some((row) => row.category === 'command_execution')) fail('Expected command_execution category count.', dashboardResult);
if (!dashboard.mappedPlaybookCounts.some((row) => row.playbookId === 'operator-playbook:mcp-tool-boundary-hardening')) fail('Expected MCP playbook count.', dashboardResult);

for (const file of ['operator-dashboard.json', 'operator-dashboard.md']) {
  if (!fs.existsSync(path.join(dashboardDir, file))) fail(`Expected ${file} artifact.`, dashboardResult);
}

fs.rmSync(rootDir, { recursive: true, force: true });
console.log('Operator dashboard export tests passed.');
