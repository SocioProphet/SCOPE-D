#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EVALUATOR = path.join(ROOT, 'scripts', 'evaluate-github-posture.js');
const FIXTURE = path.join(ROOT, 'fixtures', 'synthetic', 'github-posture.weak-controls.synthetic.json');

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

function main() {
  const outFile = path.join(os.tmpdir(), `scope-d-github-posture-${Date.now()}.json`);
  const result = cp.spawnSync(process.execPath, [EVALUATOR, FIXTURE, '--out', outFile], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status !== 0) fail(`Expected GitHub posture evaluator success, got ${result.status}`, result);
  if (!fs.existsSync(outFile)) fail('Expected evaluator to write output file.', result);

  const stdoutAssessment = parseJson(result.stdout, 'stdout assessment', result);
  const fileAssessment = parseJson(fs.readFileSync(outFile, 'utf8'), 'file assessment', result);

  if (stdoutAssessment.assessmentId !== fileAssessment.assessmentId) fail('stdout/file assessment mismatch.', result);
  if (fileAssessment.repoFullName !== 'SocioProphet/SCOPE-D') fail('Unexpected repoFullName.', result);
  if (fileAssessment.collectionMode !== 'fixture') fail('Expected fixture collectionMode.', result);
  if (fileAssessment.liveApiUsed !== false) fail('Expected liveApiUsed=false.', result);
  if (fileAssessment.liveExecutionPerformed !== false) fail('Expected liveExecutionPerformed=false.', result);
  if (fileAssessment.riskLevel !== 'critical') fail(`Expected critical risk level, got ${fileAssessment.riskLevel}.`, result);
  if (fileAssessment.riskScore !== 80) fail(`Expected riskScore=80, got ${fileAssessment.riskScore}.`, result);
  if (!Array.isArray(fileAssessment.findings) || fileAssessment.findings.length !== 8) fail('Expected 8 findings.', result);

  const categories = new Set(fileAssessment.findings.map((finding) => finding.category));
  for (const expected of ['branch_protection', 'workflow_permissions', 'code_ownership', 'secret_scanning', 'dependency_review', 'environment_protection']) {
    if (!categories.has(expected)) fail(`Missing finding category ${expected}.`, result);
  }

  fs.rmSync(outFile, { force: true });
  console.log('GitHub posture collector tests passed.');
}

main();
