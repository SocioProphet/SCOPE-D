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

const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-workorder-binding-'));
fs.rmSync(rootDir, { recursive: true, force: true });
const operatorDir = path.join(rootDir, 'operator');

const surface = cp.spawnSync(process.execPath, [
  SURFACE_RUNNER,
  '--surface', 'mcp_surface',
  '--input', MCP_FIXTURE,
  '--run-id', 'scope-d-surface-ci-binding-mcp',
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

const bundle = parseJson(bind.stdout, 'workorder binding bundle', bind);
if (bundle.executionAllowed !== false || bundle.executionPerformed !== false) fail('Expected bundle execution disabled.', bind);
if (!Array.isArray(bundle.workorders) || bundle.workorders.length !== 1) fail('Expected one bound workorder.', bind);

const workorder = bundle.workorders[0];
if (workorder.surfaceKind !== 'mcp_surface') fail('Expected MCP surface workorder binding.', bind);
if (workorder.severity !== 'critical') fail('Expected critical workorder severity.', bind);
if (workorder.executionAllowed !== false || workorder.executionPerformed !== false) fail('Expected workorder execution disabled.', bind);
if (!workorder.findingCategories.includes('command_execution')) fail('Expected command_execution finding category.', bind);
if (!workorder.findingCategories.includes('network_exposure')) fail('Expected network_exposure finding category.', bind);

const playbookIds = new Set(workorder.mappedPlaybooks.map((item) => item.playbookId));
if (!playbookIds.has('operator-playbook:mcp-tool-boundary-hardening')) fail('Expected MCP playbook match.', bind);
if (!playbookIds.has('operator-playbook:cross-surface-agent-runtime-hardening')) fail('Expected cross-surface playbook match.', bind);

for (const file of ['operator-workorders.json', 'operator-workorders.md']) {
  if (!fs.existsSync(path.join(operatorDir, file))) fail(`Expected ${file} artifact.`, bind);
}

fs.rmSync(rootDir, { recursive: true, force: true });
console.log('Operator workorder binding tests passed.');
