#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NODE = process.execPath;
const RESOLVER = path.join(ROOT, 'scripts', 'wargames-runtime-resolve.js');
const RUNTIME_CONTRACT_VALIDATOR = path.join(ROOT, 'scripts', 'validate-wargames-runtime-contracts.js');
const DISPATCH_TESTS = path.join(ROOT, 'scripts', 'test-wargames-dispatch.js');

function runScript(scriptPath, args = []) {
  return childProcess.spawnSync(NODE, [scriptPath, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function runResolver(fixture) {
  return runScript(RESOLVER, [path.join(ROOT, fixture)]);
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

function expectSuccess(label, result) {
  if (result.status !== 0) fail(`${label}: expected success, got ${result.status}`, result);
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
  expectSuccess('runtime contract schema/example validation', runScript(RUNTIME_CONTRACT_VALIDATOR));

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

  expectSuccess('dry-run dispatcher tests', runScript(DISPATCH_TESTS));

  console.log('Wargames runtime resolver tests passed.');
}

main();
