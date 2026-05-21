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
const CLIENT_REPORT = path.join(ROOT, 'scripts', 'export-client-assurance-report.js');
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

const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-client-report-'));
fs.rmSync(rootDir, { recursive: true, force: true });
const originalDir = path.join(rootDir, 'original');
const improvedDir = path.join(rootDir, 'improved');
const operatorDir = path.join(originalDir, 'operator');
const caseDir = path.join(operatorDir, 'case');
const dashboardDir = path.join(rootDir, 'dashboard');
const reportDir = path.join(rootDir, 'client-report');

run('original surface assessment', [SURFACE_RUNNER, '--surface', 'mcp_surface', '--input', ORIGINAL_FIXTURE, '--run-id', 'scope-d-surface-ci-client-original', '--out-dir', originalDir]);
run('operator intake', [OPERATOR_INTAKE, path.join(originalDir, 'surface-run-index.json'), '--out-dir', operatorDir]);
run('workorder binding', [WORKORDER_BINDER, path.join(operatorDir, 'operator-workorder.json'), '--out-dir', operatorDir]);
run('case builder', [CASE_BUILDER, path.join(operatorDir, 'operator-workorders.json'), '--source-workorder', path.join(operatorDir, 'operator-workorder.json'), '--out-dir', caseDir]);
run('improved surface assessment', [SURFACE_RUNNER, '--surface', 'mcp_surface', '--input', IMPROVED_FIXTURE, '--run-id', 'scope-d-surface-ci-client-improved', '--out-dir', improvedDir]);
run('reassessment report', [REASSESS, '--case', path.join(caseDir, 'case-index.json'), '--new-run-index', path.join(improvedDir, 'surface-run-index.json'), '--out-dir', caseDir]);
run('operator dashboard', [DASHBOARD, '--case', path.join(caseDir, 'case-index.json'), '--reassessment', path.join(caseDir, 'reassessment-report.json'), '--out-dir', dashboardDir]);

const reportResult = run('client assurance report', [
  CLIENT_REPORT,
  '--dashboard', path.join(dashboardDir, 'operator-dashboard.json'),
  '--client', 'client:synthetic-lab',
  '--case', path.join(caseDir, 'case-index.json'),
  '--reassessment', path.join(caseDir, 'reassessment-report.json'),
  '--out-dir', reportDir,
]);
const report = parseJson(reportResult.stdout, 'client assurance report', reportResult);

if (report.clientRef !== 'client:synthetic-lab') fail('Unexpected clientRef.', reportResult);
if (report.executiveSummary.caseCount !== 1) fail('Expected one reported case.', reportResult);
if (report.executiveSummary.criticalCaseCount !== 1) fail('Expected one critical case.', reportResult);
if (report.approvalState !== 'awaiting_approval') fail(`Expected awaiting_approval, got ${report.approvalState}.`, reportResult);
if (report.reassessmentStatus !== 'improved') fail(`Expected improved reassessment status, got ${report.reassessmentStatus}.`, reportResult);
if (report.executionAllowed !== false || report.executionPerformed !== false) fail('Expected report execution disabled.', reportResult);
if (!Array.isArray(report.nonClaims) || report.nonClaims.length < 5) fail('Expected explicit non-claims.', reportResult);
if (!report.nonClaims.some((claim) => claim.includes('does not certify full security'))) fail('Expected security certification non-claim.', reportResult);
if (!report.evidenceRefs.some((ref) => ref.evidenceType === 'dashboard')) fail('Expected dashboard evidence ref.', reportResult);
if (!report.evidenceRefs.some((ref) => ref.evidenceType === 'case')) fail('Expected case evidence ref.', reportResult);
if (!report.evidenceRefs.some((ref) => ref.evidenceType === 'reassessment')) fail('Expected reassessment evidence ref.', reportResult);
if (!report.recommendedActions.some((action) => action.sourcePlaybookId === 'operator-playbook:mcp-tool-boundary-hardening')) fail('Expected MCP recommended action.', reportResult);

for (const file of ['client-assurance-report.json', 'client-assurance-report.md']) {
  if (!fs.existsSync(path.join(reportDir, file))) fail(`Expected ${file} artifact.`, reportResult);
}

fs.rmSync(rootDir, { recursive: true, force: true });
console.log('Client assurance report tests passed.');
