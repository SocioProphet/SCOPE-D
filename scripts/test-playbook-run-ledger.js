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
const LEDGER = path.join(ROOT, 'scripts', 'record-playbook-run.js');
const MCP_FIXTURE = path.join(ROOT, 'fixtures', 'synthetic', 'mcp-surface.multi-tool.synthetic.json');
const MCP_PLAYBOOK = path.join(ROOT, 'playbooks', 'mcp-tool-boundary-hardening.json');

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

const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-ledger-'));
fs.rmSync(rootDir, { recursive: true, force: true });
const operatorDir = path.join(rootDir, 'operator');
const caseDir = path.join(operatorDir, 'case');
const ledgerPath = path.join(caseDir, 'playbook-run-ledger.json');

const surface = cp.spawnSync(process.execPath, [SURFACE_RUNNER, '--surface', 'mcp_surface', '--input', MCP_FIXTURE, '--run-id', 'scope-d-surface-ci-ledger-mcp', '--out-dir', rootDir], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (surface.status !== 0) fail(`Expected surface runner success, got ${surface.status}`, surface);

const intake = cp.spawnSync(process.execPath, [OPERATOR_INTAKE, path.join(rootDir, 'surface-run-index.json'), '--out-dir', operatorDir], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (intake.status !== 0) fail(`Expected operator intake success, got ${intake.status}`, intake);

const bind = cp.spawnSync(process.execPath, [WORKORDER_BINDER, path.join(operatorDir, 'operator-workorder.json'), '--out-dir', operatorDir], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (bind.status !== 0) fail(`Expected workorder binding success, got ${bind.status}`, bind);

const build = cp.spawnSync(process.execPath, [CASE_BUILDER, path.join(operatorDir, 'operator-workorders.json'), '--source-workorder', path.join(operatorDir, 'operator-workorder.json'), '--out-dir', caseDir], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (build.status !== 0) fail(`Expected case builder success, got ${build.status}`, build);

const record = cp.spawnSync(process.execPath, [
  LEDGER,
  '--case', path.join(caseDir, 'case-index.json'),
  '--playbook', MCP_PLAYBOOK,
  '--operator', 'operator:ci',
  '--step-id', 'step-review-tool-risk-records',
  '--step-status', 'completed',
  '--decision', 'complete_step',
  '--evidence', 'mcp-tool-risks.json,mcp-surface-assessment.json',
  '--notes', 'Reviewed synthetic MCP risk records.',
  '--out', ledgerPath,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (record.status !== 0) fail(`Expected ledger recorder success, got ${record.status}`, record);

const ledger = parseJson(record.stdout, 'playbook run ledger', record);
if (ledger.playbookId !== 'operator-playbook:mcp-tool-boundary-hardening') fail('Unexpected playbookId.', record);
if (ledger.operatorId !== 'operator:ci') fail('Unexpected operatorId.', record);
if (ledger.ledgerStatus !== 'in_progress') fail(`Expected in_progress ledger status, got ${ledger.ledgerStatus}.`, record);
if (ledger.executionAllowed !== false || ledger.executionPerformed !== false) fail('Expected ledger execution disabled.', record);

const completed = ledger.entries.find((entry) => entry.stepId === 'step-review-tool-risk-records');
if (!completed) fail('Missing completed ledger entry.', record);
if (completed.stepStatus !== 'completed') fail('Expected completed step status.', record);
if (completed.decision !== 'complete_step') fail('Expected complete_step decision.', record);
if (completed.executionAllowed !== false || completed.executionPerformed !== false) fail('Expected entry execution disabled.', record);
if (!completed.evidenceRefs.includes('mcp-tool-risks.json')) fail('Expected evidence ref.', record);

if (!fs.existsSync(ledgerPath)) fail('Expected ledger file artifact.', record);
fs.rmSync(rootDir, { recursive: true, force: true });
console.log('Playbook run ledger tests passed.');
