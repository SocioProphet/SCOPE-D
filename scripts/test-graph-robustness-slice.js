#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const RUN_ID = process.argv[2] || 'scope-d-ci-graph-robustness-lab';
const RUN_DIR = path.join(ROOT, 'runs', RUN_ID);
const RUN_REL = path.relative(ROOT, RUN_DIR).replace(/\\/g, '/');
const ENGAGEMENT_POLICY = 'examples/scope-d/engagement-policy.synthetic.json';

function runNodeScript(scriptName, args) {
  return childProcess.spawnSync(process.execPath, [path.join(ROOT, 'scripts', scriptName), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
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

function expectSuccess(label, result) {
  if (result.status !== 0) fail(`Expected success for ${label}.`, result);
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
}

function main() {
  if (fs.existsSync(RUN_DIR)) {
    fs.rmSync(RUN_DIR, { recursive: true, force: true });
  }

  const init = runNodeScript('init-graph-robustness-run.js', [
    '--run-id', RUN_ID,
    '--target', 'ci-graph-robustness-lab',
    '--engagement-policy', ENGAGEMENT_POLICY,
  ]);
  expectSuccess('graph robustness synthetic initializer', init);

  for (const file of [
    'engagement-policy.json',
    'graph-fixture.synthetic.json',
    'graph-robustness-assessment.json',
    'event-ir.jsonl',
    'identity-ir.json',
    'proof-artifact.json',
    'control-loop.json',
    'receipt.json',
  ]) {
    if (!fs.existsSync(path.join(RUN_DIR, file))) {
      fail(`Expected graph robustness run artifact to exist: ${file}`);
    }
  }

  const verify = runNodeScript('verify-run.js', [RUN_REL]);
  expectSuccess('graph robustness run verification', verify);

  const report = runNodeScript('report-run.js', [RUN_REL]);
  expectSuccess('graph robustness run reporting', report);

  const summary = readJson(path.join(RUN_REL, 'run-summary.json'));
  if ((summary.counts.graphRobustnessAssessments || 0) !== 1) fail('Expected one graph robustness assessment in run summary.');

  const proof = readJson(path.join(RUN_REL, 'proof-artifact.json'));
  if (!proof.dynamicMetric || proof.dynamicMetric.metricType !== 'graph_path_cost') {
    fail('Expected graph robustness proof artifact to use graph_path_cost dynamic metric.');
  }

  const rdf = runNodeScript('export-ontogenesis-rdf.js', [RUN_REL]);
  expectSuccess('graph robustness Ontogenesis export', rdf);
  if (!fs.existsSync(path.join(RUN_DIR, 'ontogenesis.ttl'))) {
    fail('Expected graph robustness Ontogenesis export to exist.');
  }

  console.log(`Graph robustness synthetic slice smoke test passed for ${RUN_REL}.`);
}

main();
