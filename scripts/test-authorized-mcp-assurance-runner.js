#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RUNNER = path.join(ROOT, 'scripts', 'run-authorized-mcp-assurance.js');
const REQUEST = path.join(ROOT, 'examples', 'scope-d', 'operator-live-readonly-request.mcp-tools-list.json');
const POLICY = path.join(ROOT, 'examples', 'scope-d', 'operator-live-readonly-policy.example.json');
const RESPONSE = path.join(ROOT, 'fixtures', 'synthetic', 'mcp-jsonrpc-tools-list-response.synthetic.json');

function fail(message, result) {
  console.error(message);
  if (result) {
    if (result.stdout) console.error(`stdout:\n${result.stdout}`);
    if (result.stderr) console.error(`stderr:\n${result.stderr}`);
  }
  process.exit(1);
}

function parseJson(text, label, result) {
  try { return JSON.parse(text); } catch (err) { fail(`${label}: expected JSON output: ${err.message}`, result); }
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-mcp-assurance-'));
fs.rmSync(tmpDir, { recursive: true, force: true });

const result = cp.spawnSync(process.execPath, [
  RUNNER,
  '--request', REQUEST,
  '--policy', POLICY,
  '--client', 'client:synthetic-lab',
  '--mock-response', RESPONSE,
  '--run-id', 'authorized-mcp-assurance-run:ci-mcp-assurance',
  '--out-dir', tmpDir,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });

if (result.status !== 0) fail(`Expected authorized MCP assurance success, got ${result.status}`, result);
const assurance = parseJson(result.stdout, 'authorized MCP assurance run', result);

if (assurance.runId !== 'authorized-mcp-assurance-run:ci-mcp-assurance') fail('Unexpected runId.', result);
if (assurance.clientRef !== 'client:synthetic-lab') fail('Unexpected clientRef.', result);
if (assurance.executionAllowed !== false || assurance.executionPerformed !== false) fail('Expected execution disabled.', result);
if (assurance.liveConnectionUsed !== false) fail('Expected mock-mode liveConnectionUsed=false.', result);

for (const file of [
  'authorized-mcp-assurance-run.json',
  path.join('authorized-discovery', 'authorized-mcp-discovery-run.json'),
  path.join('authorized-discovery', 'surface', 'surface-run-index.json'),
  path.join('operator', 'operator-workflow-run.json'),
  path.join('operator', 'operator-workorder.json'),
  path.join('operator', 'operator-workorders.json'),
  path.join('operator', 'case', 'case-index.json'),
  path.join('dashboard', 'operator-dashboard.json'),
  path.join('client-report', 'client-assurance-report.json'),
]) {
  if (!fs.existsSync(path.join(tmpDir, file))) fail(`Missing expected artifact ${file}.`, result);
}

const clientReport = parseJson(fs.readFileSync(path.join(tmpDir, 'client-report', 'client-assurance-report.json'), 'utf8'), 'client report', result);
if (clientReport.clientRef !== 'client:synthetic-lab') fail('Unexpected client report clientRef.', result);
if (clientReport.executionPerformed !== false) fail('Expected client report executionPerformed=false.', result);
if (!clientReport.evidenceRefs.some((ref) => ref.evidenceType === 'case')) fail('Expected case evidence ref in client report.', result);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Authorized MCP assurance runner tests passed.');
