#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const RUN_ID = process.argv[2] || 'scope-d-ci-reporting-lab';
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

  const init = runNodeScript('init-run.js', [
    '--run-id', RUN_ID,
    '--target', 'ci-synthetic-lab',
    '--engagement-policy', ENGAGEMENT_POLICY,
  ]);
  expectSuccess('reporting fixture run initialization', init);

  const dashboard = runNodeScript('export-dashboard-summary.js', [RUN_REL]);
  expectSuccess('dashboard export', dashboard);
  const dashboardPath = path.join(RUN_REL, 'dashboard-summary.json');
  if (!fs.existsSync(path.join(ROOT, dashboardPath))) {
    fail('Expected dashboard-summary.json to exist.');
  }
  const dashboardJson = readJson(dashboardPath);
  if (dashboardJson.verified !== true) fail('Expected dashboard export to be verified.');
  if (dashboardJson.nonProductionOnly !== true) fail('Expected dashboard export to be nonProductionOnly=true.');
  if (dashboardJson.lanes.genericProofChain.status !== 'present') fail('Expected generic proof chain lane to be present.');

  const lsa = runNodeScript('generate-lsa-map-report.js', []);
  expectSuccess('LSA map report generation', lsa);
  const reportJsonPath = 'reports/scope-d-lsa-map-report.json';
  const reportMdPath = 'reports/scope-d-lsa-map-report.md';
  if (!fs.existsSync(path.join(ROOT, reportJsonPath))) fail('Expected LSA map report JSON to exist.');
  if (!fs.existsSync(path.join(ROOT, reportMdPath))) fail('Expected LSA map report markdown to exist.');

  const report = readJson(reportJsonPath);
  if (report.topicCount !== 23) fail('Expected LSA report to cover 23 topics.');
  if (report.implementedTopicCount < 1) fail('Expected at least one proof-producing topic.');
  if (report.capturedDesignTopicCount < 1) fail('Expected at least one captured-design topic.');
  const topic20 = report.topicCoverage.find((topic) => topic.id === 20);
  if (!topic20 || topic20.status !== 'proof_producing') {
    fail('Expected topic 20 graph/topo forensics to be marked proof_producing.');
  }

  console.log(`Reporting export smoke test passed for ${RUN_REL}.`);
}

main();
