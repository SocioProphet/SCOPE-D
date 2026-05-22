#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RUNNER = path.join(ROOT, 'scripts', 'run-authorized-mcp-discovery.js');
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
  try {
    return JSON.parse(text);
  } catch (err) {
    fail(`${label}: expected JSON output: ${err.message}`, result);
  }
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-authorized-mcp-'));
fs.rmSync(tmpDir, { recursive: true, force: true });

const result = cp.spawnSync(process.execPath, [
  RUNNER,
  '--request', REQUEST,
  '--policy', POLICY,
  '--mock-response', RESPONSE,
  '--run-id', 'authorized-mcp-discovery-run:ci-mcp-tools-list',
  '--out-dir', tmpDir,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });

if (result.status !== 0) fail(`Expected authorized MCP discovery success, got ${result.status}`, result);
const run = parseJson(result.stdout, 'authorized MCP discovery run', result);

if (run.runId !== 'authorized-mcp-discovery-run:ci-mcp-tools-list') fail('Unexpected runId.', result);
if (run.decision !== 'allow') fail('Expected allow decision.', result);
if (run.executionAllowed !== false || run.executionPerformed !== false) fail('Expected execution disabled.', result);
if (run.liveConnectionUsed !== false) fail('Expected liveConnectionUsed=false for mock response run.', result);

for (const file of [
  'live-readonly-request.json',
  'live-readonly-policy.json',
  'live-readonly-decision.json',
  'mcp-discovery-source.json',
  'mcp-surface-manifest.json',
  'authorized-mcp-discovery-run.json',
  path.join('surface', 'surface-run-index.json'),
  path.join('surface', 'mcp', 'mcp-surface-assessment.json'),
  path.join('surface', 'mcp', 'mcp-tool-risks.json'),
]) {
  if (!fs.existsSync(path.join(tmpDir, file))) fail(`Missing expected artifact ${file}.`, result);
}

const assessment = parseJson(fs.readFileSync(path.join(tmpDir, 'surface', 'mcp', 'mcp-surface-assessment.json'), 'utf8'), 'MCP assessment', result);
if (assessment.liveExecutionPerformed !== false) fail('Expected assessment liveExecutionPerformed=false.', result);
if (assessment.toolCount !== 2) fail(`Expected toolCount=2, got ${assessment.toolCount}.`, result);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Authorized MCP discovery runner tests passed.');
