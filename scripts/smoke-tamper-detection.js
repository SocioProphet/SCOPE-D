#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const RUN_ID = process.argv[2] || 'scope-d-ci-tamper-lab';
const RUN_DIR = path.join(ROOT, 'runs', RUN_ID);
const RUN_REL = path.relative(ROOT, RUN_DIR).replace(/\\/g, '/');
const ENGAGEMENT_POLICY = 'examples/scope-d/engagement-policy.synthetic.json';

function runNodeScript(scriptName, args, options = {}) {
  return childProcess.spawnSync(process.execPath, [path.join(ROOT, 'scripts', scriptName), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
  });
}

function fail(message, result) {
  console.error(message);
  if (result) {
    if (result.stdout) console.error(result.stdout.trim());
    if (result.stderr) console.error(result.stderr.trim());
  }
  process.exit(1);
}

function main() {
  if (fs.existsSync(RUN_DIR)) {
    fs.rmSync(RUN_DIR, { recursive: true, force: true });
  }

  const init = runNodeScript('init-run.js', [
    '--run-id', RUN_ID,
    '--target', 'ci-tamper-lab',
    '--engagement-policy', ENGAGEMENT_POLICY,
  ]);
  if (init.status !== 0) fail('Expected scope-d init to succeed before tamper check.', init);

  const verifyBefore = runNodeScript('verify-run.js', [RUN_REL]);
  if (verifyBefore.status !== 0) fail('Expected verification to succeed before tamper.', verifyBefore);

  const reportPath = path.join(RUN_DIR, 'report.md');
  fs.appendFileSync(reportPath, '\nTamper marker for receipt verification smoke test.\n', 'utf8');

  const verifyAfter = runNodeScript('verify-run.js', [RUN_REL]);
  if (verifyAfter.status === 0) {
    fail('Expected verification to fail after report.md changed, but it succeeded.', verifyAfter);
  }

  console.log(`Tamper detection passed for ${RUN_REL}: verifier rejected changed artifact.`);
}

main();
