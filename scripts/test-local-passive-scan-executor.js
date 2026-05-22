#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PLANNER = path.join(ROOT, 'scripts', 'plan-operator-scan.js');
const EXECUTOR = path.join(ROOT, 'scripts', 'run-local-passive-scan.js');
const INGEST = path.join(ROOT, 'scripts', 'ingest-operator-scan-result.js');
const REQUEST = path.join(ROOT, 'examples', 'scope-d', 'operator-scan-request.example.json');
const POLICY = path.join(ROOT, 'examples', 'scope-d', 'operator-scan-policy.example.json');
const SOURCE = path.join(ROOT, 'fixtures', 'synthetic', 'operator-local-passive-scan-source.web-endpoint.synthetic.json');

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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-local-passive-'));
const planDir = path.join(tmpDir, 'plan');
const resultPath = path.join(tmpDir, 'operator-scan-result.json');
const assessmentPath = path.join(tmpDir, 'operator-scan-result-assessment.json');

const planned = cp.spawnSync(process.execPath, [PLANNER, REQUEST, '--policy', POLICY, '--out-dir', planDir], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (planned.status !== 0) fail(`Expected scan planner success, got ${planned.status}`, planned);
const planPayload = parseJson(planned.stdout, 'scan planner output', planned);
if (planPayload.decision.decision !== 'allow_plan') fail('Expected allow_plan decision.', planned);

const executed = cp.spawnSync(process.execPath, [
  EXECUTOR,
  '--plan', path.join(planDir, 'operator-scan-plan.json'),
  '--source', SOURCE,
  '--out', resultPath,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (executed.status !== 0) fail(`Expected local passive scan success, got ${executed.status}`, executed);
const scanResult = parseJson(executed.stdout, 'operator scan result', executed);
if (scanResult.targetRef !== 'example.com') fail('Unexpected scan result targetRef.', executed);
if (scanResult.surfaceKind !== 'web_endpoint') fail('Unexpected scan result surfaceKind.', executed);
if (scanResult.networkAccessAttempted !== false || scanResult.scanExecutionPerformed !== false) fail('Expected no network or scan execution.', executed);
if (scanResult.credentialAccessAttempted !== false || scanResult.payloadDeliveryAttempted !== false || scanResult.mutationAttempted !== false) fail('Expected no credential/payload/mutation attempts.', executed);
if (scanResult.observations.length !== 2) fail(`Expected 2 observations matching the plan, got ${scanResult.observations.length}.`, executed);
if (!fs.existsSync(resultPath)) fail('Expected scan result artifact.', executed);

const ingested = cp.spawnSync(process.execPath, [INGEST, resultPath, '--out', assessmentPath], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (ingested.status !== 0) fail(`Expected scan result ingestion success, got ${ingested.status}`, ingested);
const assessment = parseJson(ingested.stdout, 'scan result assessment', ingested);
if (assessment.findingCount !== 2) fail(`Expected 2 findings, got ${assessment.findingCount}.`, ingested);
if (assessment.riskScore !== 30) fail(`Expected riskScore=30, got ${assessment.riskScore}.`, ingested);
if (assessment.riskLevel !== 'medium') fail(`Expected riskLevel=medium, got ${assessment.riskLevel}.`, ingested);
if (assessment.networkAccessAttempted !== false || assessment.scanExecutionPerformed !== false) fail('Expected assessment execution flags false.', ingested);

const categories = new Set(assessment.findings.map((finding) => finding.category));
for (const expected of ['http_exposure', 'missing_tls']) {
  if (!categories.has(expected)) fail(`Missing finding category ${expected}.`, ingested);
}

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Local passive scan executor tests passed.');
