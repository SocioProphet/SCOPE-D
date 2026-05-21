#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EVALUATOR = path.join(ROOT, 'scripts', 'evaluate-ai-runtime-exposure.js');
const FIXTURE = path.join(ROOT, 'fixtures', 'synthetic', 'ai-runtime-exposure.high-risk.synthetic.json');

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

const outFile = path.join(os.tmpdir(), `scope-d-ai-runtime-${Date.now()}.json`);
const result = cp.spawnSync(process.execPath, [EVALUATOR, FIXTURE, '--out', outFile], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: 'pipe',
});

if (result.status !== 0) fail(`Expected AI runtime evaluator success, got ${result.status}`, result);
if (!fs.existsSync(outFile)) fail('Expected evaluator to write output file.', result);

const stdoutAssessment = parseJson(result.stdout, 'stdout assessment', result);
const fileAssessment = parseJson(fs.readFileSync(outFile, 'utf8'), 'file assessment', result);

if (stdoutAssessment.assessmentId !== fileAssessment.assessmentId) fail('stdout/file assessment mismatch.', result);
if (fileAssessment.runtimeRef !== 'ai-runtime:lab-agent-runtime') fail('Unexpected runtimeRef.', result);
if (fileAssessment.environment !== 'lab') fail('Unexpected environment.', result);
if (fileAssessment.riskLevel !== 'critical') fail(`Expected critical risk level, got ${fileAssessment.riskLevel}.`, result);
if (fileAssessment.riskScore !== 100) fail(`Expected riskScore=100, got ${fileAssessment.riskScore}.`, result);
if (fileAssessment.liveConnectionUsed !== false) fail('Expected liveConnectionUsed=false.', result);
if (fileAssessment.promptExecutionPerformed !== false) fail('Expected promptExecutionPerformed=false.', result);

const categories = new Set(fileAssessment.findings.map((finding) => finding.category));
for (const expected of ['public_endpoint', 'tenant_isolation', 'missing_auth', 'unscoped_tokens', 'tool_binding', 'memory_exposure', 'prompt_boundary', 'logging_exposure', 'missing_rate_limit']) {
  if (!categories.has(expected)) fail(`Missing finding category ${expected}.`, result);
}

fs.rmSync(outFile, { force: true });
console.log('AI runtime exposure evaluator tests passed.');
