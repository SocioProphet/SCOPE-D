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
const LEDGER_TEST = path.join(ROOT, 'scripts', 'test-playbook-run-ledger.js');
const MCP_FIXTURE = path.join(ROOT, 'fixtures', 'synthetic', 'mcp-surface.multi-tool.synthetic.json');

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

const ledgerTest = cp.spawnSync(process.execPath, [LEDGER_TEST], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (ledgerTest.status !== 0) fail(`Expected playbook ledger test success, got ${ledgerTest.status}`, ledgerTest);

const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-case-bundle-'));
fs.rmSync(rootDir, { recursive: true, force: true });
const operatorDir = path.join(rootDir, 'operator');
const caseDir = path.join(operatorDir, 'case');

const surface = cp.spawnSync(process.execPath, [
  SURFACE_RUNNER,
  '--surface', 'mcp_surface',
  '--input', MCP_FIXTURE,
  '--run-id', 'scope-d-surface-ci-case-mcp',
  '--out-dir', rootDir,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (surface.status !== 0) fail(`Expected surface runner success, got ${surface.status}`, surface);

const intake = cp.spawnSync(process.execPath, [
  OPERATOR_INTAKE,
  path.join(rootDir, 'surface-run-index.json'),
  '--out-dir', operatorDir,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (intake.status !== 0) fail(`Expected operator intake success, got ${intake.status}`, intake);

const bind = cp.spawnSync(process.execPath, [
  WORKORDER_BINDER,
  path.join(operatorDir, 'operator-workorder.json'),
  '--out-dir', operatorDir,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (bind.status !== 0) fail(`Expected workorder binding success, got ${bind.status}`, bind);

const build = cp.spawnSync(process.execPath, [
  CASE_BUILDER,
  path.join(operatorDir, 'operator-workorders.json'),
  '--source-workorder', path.join(operatorDir, 'operator-workorder.json'),
  '--out-dir', caseDir,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (build.status !== 0) fail(`Expected case builder success, got ${build.status}`, build);

const caseIndex = parseJson(build.stdout, 'case index', build);
if (caseIndex.surfaceKind !== 'mcp_surface') fail('Expected MCP surface case.', build);
if (caseIndex.severity !== 'critical') fail('Expected critical case severity.', build);
if (caseIndex.caseState !== 'awaiting_approval') fail(`Expected awaiting_approval case state, got ${caseIndex.caseState}.`, build);
if (caseIndex.executionAllowed !== false || caseIndex.executionPerformed !== false) fail('Expected case execution disabled.', build);
if (!Array.isArray(caseIndex.mappedPlaybooks) || caseIndex.mappedPlaybooks.length < 2) fail('Expected mapped playbooks.', build);
if (!caseIndex.artifactRefs.some((artifact) => artifact.artifactType === 'playbook')) fail('Expected playbook artifact refs.', build);
if (!caseIndex.artifactRefs.some((artifact) => artifact.artifactType === 'assessment')) fail('Expected assessment artifact ref.', build);

for (const file of ['case-index.json', 'case-summary.md']) {
  if (!fs.existsSync(path.join(caseDir, file))) fail(`Expected ${file} artifact.`, build);
}

fs.rmSync(rootDir, { recursive: true, force: true });
console.log('Operator case bundle tests passed.');
