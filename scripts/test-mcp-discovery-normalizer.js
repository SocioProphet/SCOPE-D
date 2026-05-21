#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NORMALIZER = path.join(ROOT, 'scripts', 'normalize-mcp-discovery.js');
const EVALUATOR = path.join(ROOT, 'scripts', 'evaluate-mcp-surface.js');
const FIXTURE = path.join(ROOT, 'fixtures', 'synthetic', 'mcp-discovery.tools-list.synthetic.json');

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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-mcp-discovery-'));
const manifestPath = path.join(tmpDir, 'mcp-surface-manifest.json');
const assessmentDir = path.join(tmpDir, 'assessment');

const normalize = cp.spawnSync(process.execPath, [NORMALIZER, FIXTURE, '--out', manifestPath], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: 'pipe',
});

if (normalize.status !== 0) fail(`Expected normalizer success, got ${normalize.status}`, normalize);
if (!fs.existsSync(manifestPath)) fail('Expected normalized MCP surface manifest file.', normalize);
const manifest = parseJson(normalize.stdout, 'normalized MCP manifest', normalize);
if (manifest.serverRef !== 'synthetic-mcp-server:lab-tools-list') fail('Unexpected serverRef.', normalize);
if (manifest.tools.length !== 2) fail(`Expected 2 tools, got ${manifest.tools.length}.`, normalize);
if (manifest.liveConnectionUsed !== false) fail('Expected liveConnectionUsed=false.', normalize);
if (manifest.tools[0].toolName !== 'web_fetch') fail('Expected first normalized tool web_fetch.', normalize);
if (!manifest.tools[0].riskHints.includes('network_exposure')) fail('Expected propagated network_exposure risk hint.', normalize);

const evaluate = cp.spawnSync(process.execPath, [EVALUATOR, manifestPath, '--out-dir', assessmentDir], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: 'pipe',
});

if (evaluate.status !== 0) fail(`Expected evaluator success, got ${evaluate.status}`, evaluate);
const payload = parseJson(evaluate.stdout, 'MCP evaluator output', evaluate);
if (payload.assessment.toolCount !== 2) fail('Expected assessment toolCount=2.', evaluate);
if (payload.assessment.riskLevel !== 'critical') fail(`Expected critical risk, got ${payload.assessment.riskLevel}.`, evaluate);
const categories = new Set(payload.risks.map((risk) => risk.riskCategory));
for (const expected of ['network_exposure', 'overbroad_tool', 'unsafe_arguments', 'filesystem_exposure', 'missing_auth']) {
  if (!categories.has(expected)) fail(`Missing risk category ${expected}.`, evaluate);
}

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('MCP discovery normalizer tests passed.');
