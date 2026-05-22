#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INGEST = path.join(ROOT, 'scripts', 'ingest-operator-scan-result.js');
const FIXTURE = path.join(ROOT, 'fixtures', 'synthetic', 'operator-scan-result.web-endpoint.synthetic.json');

function fail(message, result) {
  console.error(message);
  if (result) {
    if (result.stdout) console.error(`stdout:\n${result.stdout}`);
    if (result.stderr) console.error(`stderr:\n${result.stderr}`);
  }
  process.exit(1);
}

function parseJson(text, label, result) {
  try { return JSON.parse(text); } catch (err) { fail(`${label}: expected JSON output: ${err.message}`, result); }
}

const outFile = path.join(os.tmpdir(), `scope-d-scan-result-assessment-${Date.now()}.json`);
const result = cp.spawnSync(process.execPath, [INGEST, FIXTURE, '--out', outFile], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });

if (result.status !== 0) fail(`Expected scan result ingestion success, got ${result.status}`, result);
if (!fs.existsSync(outFile)) fail('Expected assessment output file.', result);

const assessment = parseJson(result.stdout, 'scan result assessment', result);
if (assessment.targetRef !== 'example.com') fail('Unexpected targetRef.', result);
if (assessment.surfaceKind !== 'web_endpoint') fail('Unexpected surfaceKind.', result);
if (assessment.findingCount !== 3) fail(`Expected 3 findings, got ${assessment.findingCount}.`, result);
if (assessment.riskScore !== 35) fail(`Expected riskScore=35, got ${assessment.riskScore}.`, result);
if (assessment.riskLevel !== 'medium') fail(`Expected riskLevel=medium, got ${assessment.riskLevel}.`, result);
if (assessment.networkAccessAttempted !== false || assessment.scanExecutionPerformed !== false) fail('Expected execution flags false.', result);

const categories = new Set(assessment.findings.map((finding) => finding.category));
for (const expected of ['http_exposure', 'missing_tls', 'service_banner_present']) {
  if (!categories.has(expected)) fail(`Missing finding category ${expected}.`, result);
}

const fileAssessment = parseJson(fs.readFileSync(outFile, 'utf8'), 'assessment file', result);
if (fileAssessment.assessmentId !== assessment.assessmentId) fail('stdout/file assessment mismatch.', result);

fs.rmSync(outFile, { force: true });
console.log('Operator scan result ingestion tests passed.');
