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

const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-reassessment-'));
fs.rmSync(rootDir, { recursive: true, force: true });
const originalDir = path.join(rootDir, 'original');
const improvedDir = path.join(rootDir, 'improved');
const operatorDir = path.join(originalDir, 'operator');
const caseDir = path.join(operatorDir, 'case');

const original = run('original surface assessment', [
  SURFACE_RUNNER,
  '--surface', 'mcp_surface',
  '--input', ORIGINAL_FIXTURE,
  '--run-id', 'scope-d-surface-ci-reassess-original',
  '--out-dir', originalDir,
]);
const originalIndex = parseJson(original.stdout, 'original surface index', original);
if (originalIndex.riskLevel !== 'critical') fail('Expected critical original risk.', original);

run('operator intake', [OPERATOR_INTAKE, path.join(originalDir, 'surface-run-index.json'), '--out-dir', operatorDir]);
run('workorder binding', [WORKORDER_BINDER, path.join(operatorDir, 'operator-workorder.json'), '--out-dir', operatorDir]);
run('case builder', [CASE_BUILDER, path.join(operatorDir, 'operator-workorders.json'), '--source-workorder', path.join(operatorDir, 'operator-workorder.json'), '--out-dir', caseDir]);

const improved = run('improved surface assessment', [
  SURFACE_RUNNER,
  '--surface', 'mcp_surface',
  '--input', IMPROVED_FIXTURE,
  '--run-id', 'scope-d-surface-ci-reassess-improved',
  '--out-dir', improvedDir,
]);
const improvedIndex = parseJson(improved.stdout, 'improved surface index', improved);
if (improvedIndex.riskScore >= originalIndex.riskScore) fail('Expected improved risk score to decrease.', improved);

const reportResult = run('reassessment report', [
  REASSESS,
  '--case', path.join(caseDir, 'case-index.json'),
  '--new-run-index', path.join(improvedDir, 'surface-run-index.json'),
  '--out-dir', caseDir,
]);
const report = parseJson(reportResult.stdout, 'reassessment report', reportResult);

if (report.outcome !== 'improved') fail(`Expected improved outcome, got ${report.outcome}.`, reportResult);
if (report.riskDelta >= 0) fail(`Expected negative riskDelta, got ${report.riskDelta}.`, reportResult);
if (report.previousRiskLevel !== 'critical') fail('Expected previous critical risk level.', reportResult);
if (report.newRiskScore >= report.previousRiskScore) fail('Expected lower newRiskScore.', reportResult);
if (report.closedFindingEstimate <= 0) fail('Expected positive closed finding estimate.', reportResult);
if (report.executionAllowed !== false || report.executionPerformed !== false) fail('Expected reassessment execution disabled.', reportResult);

for (const file of ['reassessment-report.json', 'reassessment-report.md']) {
  if (!fs.existsSync(path.join(caseDir, file))) fail(`Expected ${file} artifact.`, reportResult);
}

fs.rmSync(rootDir, { recursive: true, force: true });
console.log('Reassessment workflow tests passed.');
