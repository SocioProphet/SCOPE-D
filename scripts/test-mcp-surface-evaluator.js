#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EVALUATOR = path.join(ROOT, 'scripts', 'evaluate-mcp-surface.js');
const FIXTURE = path.join(ROOT, 'fixtures', 'synthetic', 'mcp-surface.multi-tool.synthetic.json');

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

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-mcp-surface-'));
const result = cp.spawnSync(process.execPath, [EVALUATOR, FIXTURE, '--out-dir', outDir], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: 'pipe',
});

if (result.status !== 0) fail(`Expected MCP surface evaluator success, got ${result.status}`, result);

const payload = parseJson(result.stdout, 'MCP evaluator stdout', result);
const assessment = payload.assessment;
const risks = payload.risks;

if (!assessment) fail('Expected assessment in evaluator output.', result);
if (!Array.isArray(risks)) fail('Expected risks array in evaluator output.', result);
if (assessment.serverRef !== 'synthetic-mcp-server:lab-browser-tools') fail('Unexpected serverRef.', result);
if (assessment.toolCount !== 3) fail(`Expected toolCount=3, got ${assessment.toolCount}.`, result);
if (assessment.riskLevel !== 'critical') fail(`Expected critical risk level, got ${assessment.riskLevel}.`, result);
if (assessment.liveConnectionUsed !== false) fail('Expected liveConnectionUsed=false.', result);
if (assessment.liveExecutionPerformed !== false) fail('Expected liveExecutionPerformed=false.', result);
if (risks.length < 8) fail(`Expected at least 8 MCP tool risks, got ${risks.length}.`, result);

const categories = new Set(risks.map((risk) => risk.riskCategory));
for (const expected of ['command_execution', 'filesystem_exposure', 'network_exposure', 'overbroad_tool', 'unsafe_arguments', 'hidden_instruction_channel', 'ambiguous_description', 'missing_auth']) {
  if (!categories.has(expected)) fail(`Missing MCP risk category ${expected}.`, result);
}

for (const file of ['mcp-surface-assessment.json', 'mcp-tool-risks.json']) {
  if (!fs.existsSync(path.join(outDir, file))) fail(`Expected ${file} to be written.`, result);
}

fs.rmSync(outDir, { recursive: true, force: true });
console.log('MCP surface evaluator tests passed.');
