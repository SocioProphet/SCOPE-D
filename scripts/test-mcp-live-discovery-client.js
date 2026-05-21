#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DISCOVER = path.join(ROOT, 'scripts', 'discover-mcp-tools.js');
const NORMALIZER = path.join(ROOT, 'scripts', 'normalize-mcp-discovery.js');
const EVALUATOR = path.join(ROOT, 'scripts', 'evaluate-mcp-surface.js');
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-mcp-discover-'));
const sourcePath = path.join(tmpDir, 'mcp-discovery-source.json');
const manifestPath = path.join(tmpDir, 'mcp-surface-manifest.json');
const assessmentDir = path.join(tmpDir, 'assessment');

const discover = cp.spawnSync(process.execPath, [
  DISCOVER,
  '--server-ref', 'synthetic-mcp-server:jsonrpc-tools',
  '--server-name', 'Synthetic JSON-RPC Tools',
  '--environment', 'lab',
  '--transport', 'http',
  '--mock-response', RESPONSE,
  '--out', sourcePath,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });

if (discover.status !== 0) fail(`Expected discovery success, got ${discover.status}`, discover);
if (!fs.existsSync(sourcePath)) fail('Expected discovery source file.', discover);
const source = parseJson(discover.stdout, 'discovery source', discover);
if (source.liveConnectionUsed !== false) fail('Expected liveConnectionUsed=false for mock discovery.', discover);
if (source.toolExecutionPerformed !== false) fail('Expected toolExecutionPerformed=false.', discover);
if (source.tools.length !== 2) fail(`Expected 2 discovered tools, got ${source.tools.length}.`, discover);
if (!source.tools[0].permissions.includes('network.fetch')) fail('Expected inferred network.fetch permission.', discover);

const normalize = cp.spawnSync(process.execPath, [NORMALIZER, sourcePath, '--out', manifestPath], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (normalize.status !== 0) fail(`Expected normalizer success, got ${normalize.status}`, normalize);
const manifest = parseJson(normalize.stdout, 'normalized manifest', normalize);
if (manifest.tools.length !== 2) fail('Expected normalized two-tool surface.', normalize);

const evaluate = cp.spawnSync(process.execPath, [EVALUATOR, manifestPath, '--out-dir', assessmentDir], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (evaluate.status !== 0) fail(`Expected evaluator success, got ${evaluate.status}`, evaluate);
const payload = parseJson(evaluate.stdout, 'MCP evaluator output', evaluate);
if (payload.assessment.toolCount !== 2) fail('Expected assessment toolCount=2.', evaluate);
if (payload.assessment.liveConnectionUsed !== false) fail('Expected liveConnectionUsed=false assessment.', evaluate);
if (payload.assessment.liveExecutionPerformed !== false) fail('Expected liveExecutionPerformed=false assessment.', evaluate);
const categories = new Set(payload.risks.map((risk) => risk.riskCategory));
for (const expected of ['network_exposure', 'unsafe_arguments', 'filesystem_exposure', 'missing_auth']) {
  if (!categories.has(expected)) fail(`Missing MCP risk category ${expected}.`, evaluate);
}

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('MCP discovery client tests passed.');
