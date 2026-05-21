#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RUNNER = path.join(ROOT, 'scripts', 'run-surface-assessment.js');

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

function runCase(surface, input, expectedLevel, expectedMinFindings) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), `scope-d-surface-${surface}-`));
  fs.rmSync(outDir, { recursive: true, force: true });
  const runId = `scope-d-surface-ci-${surface}`;
  const result = cp.spawnSync(process.execPath, [
    RUNNER,
    '--surface', surface,
    '--input', path.join(ROOT, input),
    '--run-id', runId,
    '--out-dir', outDir,
  ], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });

  if (result.status !== 0) fail(`Expected ${surface} runner success, got ${result.status}`, result);
  const index = parseJson(result.stdout, `${surface} run index`, result);
  if (index.runId !== runId) fail(`${surface}: runId mismatch`, result);
  if (index.surfaceKind !== surface) fail(`${surface}: surfaceKind mismatch`, result);
  if (index.riskLevel !== expectedLevel) fail(`${surface}: expected risk ${expectedLevel}, got ${index.riskLevel}`, result);
  if (index.findingCount < expectedMinFindings) fail(`${surface}: expected at least ${expectedMinFindings} findings, got ${index.findingCount}`, result);
  if (index.executionPerformed !== false) fail(`${surface}: executionPerformed must be false`, result);

  for (const artifact of index.artifacts) {
    if (!fs.existsSync(path.join(ROOT, artifact.path))) fail(`${surface}: missing artifact ${artifact.path}`, result);
  }

  const summary = path.join(outDir, 'surface-summary.md');
  if (!fs.existsSync(summary)) fail(`${surface}: missing surface-summary.md`, result);
  fs.rmSync(outDir, { recursive: true, force: true });
}

runCase('mcp_surface', 'fixtures/synthetic/mcp-surface.multi-tool.synthetic.json', 'critical', 8);
runCase('ai_runtime', 'fixtures/synthetic/ai-runtime-exposure.high-risk.synthetic.json', 'critical', 9);
runCase('k8s_manifest', 'fixtures/synthetic/k8s-manifest.high-risk.synthetic.json', 'critical', 8);

console.log('Surface assessment runner tests passed.');
