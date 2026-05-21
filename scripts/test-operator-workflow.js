#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SURFACE_RUNNER = path.join(ROOT, 'scripts', 'run-surface-assessment.js');
const OPERATOR_INTAKE = path.join(ROOT, 'scripts', 'operator-intake.js');
const PLAYBOOK_TEST = path.join(ROOT, 'scripts', 'test-operator-playbooks.js');
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

const playbookResult = cp.spawnSync(process.execPath, [PLAYBOOK_TEST], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (playbookResult.status !== 0) fail(`Expected playbook catalog validation success, got ${playbookResult.status}`, playbookResult);

const surfaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-operator-surface-'));
fs.rmSync(surfaceDir, { recursive: true, force: true });
const operatorDir = path.join(surfaceDir, 'operator');

const surface = cp.spawnSync(process.execPath, [
  SURFACE_RUNNER,
  '--surface', 'mcp_surface',
  '--input', MCP_FIXTURE,
  '--run-id', 'scope-d-surface-ci-operator-mcp',
  '--out-dir', surfaceDir,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });

if (surface.status !== 0) fail(`Expected surface runner success, got ${surface.status}`, surface);
const surfaceIndex = parseJson(surface.stdout, 'surface index', surface);
if (surfaceIndex.riskLevel !== 'critical') fail('Expected critical surface index for operator workflow.', surface);

const indexPath = path.join(surfaceDir, 'surface-run-index.json');
const intake = cp.spawnSync(process.execPath, [OPERATOR_INTAKE, indexPath, '--out-dir', operatorDir], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: 'pipe',
});

if (intake.status !== 0) fail(`Expected operator intake success, got ${intake.status}`, intake);
const payload = parseJson(intake.stdout, 'operator intake payload', intake);

if (payload.workflow.status !== 'remediation_required') fail('Expected workflow remediation_required status.', intake);
if (payload.workflow.queue !== 'critical') fail('Expected workflow critical queue.', intake);
if (payload.workflow.executionPerformed !== false) fail('Expected workflow executionPerformed=false.', intake);

if (payload.triage.decision !== 'remediation_required') fail('Expected triage remediation_required.', intake);
if (payload.triage.approvalRequired !== true) fail('Expected triage approvalRequired=true for critical risk.', intake);
if (payload.triage.executionAllowed !== false || payload.triage.executionPerformed !== false) fail('Expected triage execution disabled.', intake);

if (payload.workorder.surfaceKind !== 'mcp_surface') fail('Expected MCP surface workorder.', intake);
if (payload.workorder.severity !== 'critical') fail('Expected critical workorder severity.', intake);
if (payload.workorder.recommendedOwner !== 'ai-security') fail('Expected ai-security workorder owner.', intake);
if (payload.workorder.executionAllowed !== false || payload.workorder.executionPerformed !== false) fail('Expected workorder execution disabled.', intake);
if (!payload.workorder.blockedActions.includes('tool_invocation')) fail('Expected tool_invocation blocked action.', intake);

for (const file of ['operator-workflow-run.json', 'operator-triage-decision.json', 'operator-workorder.json']) {
  if (!fs.existsSync(path.join(operatorDir, file))) fail(`Expected ${file} artifact.`, intake);
}

fs.rmSync(surfaceDir, { recursive: true, force: true });
console.log('Operator workflow tests passed.');
