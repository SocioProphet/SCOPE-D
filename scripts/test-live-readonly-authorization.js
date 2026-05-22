#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AUTH = path.join(ROOT, 'scripts', 'authorize-live-readonly-request.js');
const ALLOW = path.join(ROOT, 'examples', 'scope-d', 'operator-live-readonly-request.mcp-tools-list.json');
const BLOCK = path.join(ROOT, 'fixtures', 'invalid', 'operator-live-readonly-request-tool-call.invalid.json');
const POLICY = path.join(ROOT, 'examples', 'scope-d', 'operator-live-readonly-policy.example.json');

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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-live-auth-'));
const allowOut = path.join(tmpDir, 'allow-decision.json');
const blockOut = path.join(tmpDir, 'block-decision.json');

const allowed = cp.spawnSync(process.execPath, [AUTH, ALLOW, '--policy', POLICY, '--out', allowOut], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: 'pipe',
});
if (allowed.status !== 0) fail(`Expected allow request success, got ${allowed.status}`, allowed);
const allowDecision = parseJson(allowed.stdout, 'allow decision', allowed);
if (allowDecision.decision !== 'allow') fail('Expected allow decision.', allowed);
if (allowDecision.executionAllowed !== false || allowDecision.executionPerformed !== false) fail('Expected allow decision execution disabled.', allowed);
if (allowDecision.readMethod !== 'mcp_tools_list') fail('Expected mcp_tools_list decision.', allowed);
if (!fs.existsSync(allowOut)) fail('Expected allow decision output file.', allowed);

const blocked = cp.spawnSync(process.execPath, [AUTH, BLOCK, '--policy', POLICY, '--out', blockOut], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: 'pipe',
});
if (blocked.status === 0) fail('Expected blocked request to fail nonzero.', blocked);
const blockDecision = parseJson(blocked.stdout, 'block decision', blocked);
if (blockDecision.decision !== 'hard_block') fail('Expected hard_block decision.', blocked);
if (!blockDecision.reason.includes('tool invocation')) fail('Expected tool invocation block reason.', blocked);
if (blockDecision.executionAllowed !== false || blockDecision.executionPerformed !== false) fail('Expected block decision execution disabled.', blocked);
if (!fs.existsSync(blockOut)) fail('Expected block decision output file.', blocked);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Live read-only authorization tests passed.');
