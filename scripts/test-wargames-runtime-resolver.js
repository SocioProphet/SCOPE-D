#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NODE = process.execPath;
const RESOLVER = path.join(ROOT, 'scripts', 'wargames-runtime-resolve.js');

function runResolver(fixture) {
  return childProcess.spawnSync(NODE, [RESOLVER, path.join(ROOT, fixture)], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function parseReceipt(result, label) {
  if (!result.stdout) {
    fail(`${label}: resolver emitted no stdout`, result);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (err) {
    fail(`${label}: resolver stdout was not JSON: ${err.message}`, result);
  }
}

function fail(message, result) {
  console.error(message);
  if (result) {
    if (result.stdout) console.error(`stdout:\n${result.stdout}`);
    if (result.stderr) console.error(`stderr:\n${result.stderr}`);
  }
  process.exit(1);
}

function expectDecision(label, fixture, expectedStatus, expectedDecision, expectedReasonFragment) {
  const result = runResolver(fixture);
  if (result.status !== expectedStatus) {
    fail(`${label}: expected exit status ${expectedStatus}, got ${result.status}`, result);
  }
  const receipt = parseReceipt(result, label);
  if (receipt.decision !== expectedDecision) {
    fail(`${label}: expected decision ${expectedDecision}, got ${receipt.decision}`, result);
  }
  if (receipt.liveExecutionPerformed !== false) {
    fail(`${label}: expected liveExecutionPerformed=false`, result);
  }
  if (expectedReasonFragment && !receipt.reason.includes(expectedReasonFragment)) {
    fail(`${label}: expected reason to include "${expectedReasonFragment}", got "${receipt.reason}"`, result);
  }
}

function main() {
  expectDecision(
    'allowed validation invocation',
    'examples/scope-d/wargames/runtime/invocation-allow-validate.synthetic.json',
    0,
    'allow',
    'No live execution performed'
  );

  expectDecision(
    'review required for incomplete evidence',
    'examples/scope-d/wargames/runtime/invocation-review-incomplete-evidence.synthetic.json',
    3,
    'review_required',
    'lacks complete evidence/proof grounding'
  );

  expectDecision(
    'hard block raw identity join',
    'examples/scope-d/wargames/runtime/negative-fixtures/invocation-raw-identity-join.invalid.json',
    2,
    'hard_block',
    'Raw identity join requested'
  );

  expectDecision(
    'hard block missing Michael approval',
    'examples/scope-d/wargames/runtime/negative-fixtures/invocation-missing-michael.invalid.json',
    2,
    'hard_block',
    'requires an engagement authorization reference'
  );

  expectDecision(
    'hard block live execution',
    'examples/scope-d/wargames/runtime/negative-fixtures/invocation-live-execution.invalid.json',
    2,
    'hard_block',
    'Live execution was requested'
  );

  console.log('Wargames runtime resolver tests passed.');
}

main();
