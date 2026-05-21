#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DISPATCH = path.join(ROOT, 'scripts', 'wargames-dispatch.js');

function runCase(fixture, runId) {
  const outDir = path.join(os.tmpdir(), `scope-d-${runId}`);
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
  const result = cp.spawnSync(process.execPath, [DISPATCH, path.join(ROOT, fixture), '--run-id', runId, '--out-dir', outDir], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return { result, outDir };
}

function fail(msg, result) {
  console.error(msg);
  if (result) {
    if (result.stdout) console.error(result.stdout.trim());
    if (result.stderr) console.error(result.stderr.trim());
  }
  process.exit(1);
}

function parse(text, label, result) {
  try { return JSON.parse(text); } catch (err) { fail(`${label}: bad JSON`, result); }
}

function expect(label, fixture, runId, code, decision, status) {
  const { result, outDir } = runCase(fixture, runId);
  if (result.status !== code) fail(`${label}: expected ${code}, got ${result.status}`, result);
  const summary = parse(result.stdout, label, result);
  if (summary.decision !== decision) fail(`${label}: decision mismatch`, result);
  if (summary.status !== status) fail(`${label}: status mismatch`, result);
  if (summary.dryRunOnly !== true || summary.liveExecutionPerformed !== false) fail(`${label}: unsafe summary flags`, result);
  for (const file of ['invocation.json', 'runtime-decision-receipt.json', 'dispatch-summary.json']) {
    if (!fs.existsSync(path.join(outDir, file))) fail(`${label}: missing ${file}`, result);
  }
  const receipt = parse(fs.readFileSync(path.join(outDir, 'runtime-decision-receipt.json'), 'utf8'), label, result);
  if (receipt.decision !== decision || receipt.liveExecutionPerformed !== false) fail(`${label}: receipt mismatch`, result);
  fs.rmSync(outDir, { recursive: true, force: true });
}

expect('allow', 'examples/scope-d/wargames/runtime/invocation-allow-validate.synthetic.json', 'scope-d-wargames-ci-allow-dispatch', 0, 'allow', 'completed');
expect('review', 'examples/scope-d/wargames/runtime/invocation-review-incomplete-evidence.synthetic.json', 'scope-d-wargames-ci-review-dispatch', 3, 'review_required', 'review_required');
expect('block', 'examples/scope-d/wargames/runtime/negative-fixtures/invocation-live-execution.invalid.json', 'scope-d-wargames-ci-block-dispatch', 2, 'hard_block', 'blocked');

console.log('Wargames dry-run dispatcher tests passed.');
