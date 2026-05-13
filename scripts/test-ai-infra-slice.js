#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const RUN_ID = process.argv[2] || 'scope-d-ci-ai-infra-lab';
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

  const init = runNodeScript('init-ai-infra-run.js', [
    '--run-id', RUN_ID,
    '--target', 'ci-ai-infra-lab',
    '--engagement-policy', ENGAGEMENT_POLICY,
  ]);
  expectSuccess('AI-infra synthetic initializer', init);

  for (const file of [
    'engagement-policy.json',
    'mcp-tool-manifest.synthetic.json',
    'ai-infra-assessment.json',
    'mcp-tool-risk.json',
    'countermeasure-rule.json',
    'event-ir.jsonl',
    'identity-ir.json',
    'proof-artifact.json',
    'control-loop.json',
    'receipt.json',
  ]) {
    if (!fs.existsSync(path.join(RUN_DIR, file))) {
      fail(`Expected AI-infra run artifact to exist: ${file}`);
    }
  }

  const verify = runNodeScript('verify-run.js', [RUN_REL]);
  expectSuccess('AI-infra run verification', verify);

  const report = runNodeScript('report-run.js', [RUN_REL]);
  expectSuccess('AI-infra run reporting', report);

  const summary = readJson(path.join(RUN_REL, 'run-summary.json'));
  if ((summary.counts.aiInfraAssessments || 0) !== 1) fail('Expected one AI-infra assessment in run summary.');
  if ((summary.counts.mcpToolRisks || 0) !== 1) fail('Expected one MCP tool risk in run summary.');
  if ((summary.counts.countermeasureRules || 0) !== 1) fail('Expected one countermeasure rule in run summary.');

  const rdf = runNodeScript('export-ontogenesis-rdf.js', [RUN_REL]);
  expectSuccess('AI-infra Ontogenesis export', rdf);
  if (!fs.existsSync(path.join(RUN_DIR, 'ontogenesis.ttl'))) {
    fail('Expected AI-infra Ontogenesis export to exist.');
  }

  console.log(`AI-infra synthetic slice smoke test passed for ${RUN_REL}.`);
}

main();
