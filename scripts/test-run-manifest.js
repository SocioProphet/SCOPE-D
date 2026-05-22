#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSURANCE = path.join(ROOT, 'scripts', 'run-scan-assurance.js');
const MANIFEST = path.join(ROOT, 'scripts', 'generate-run-manifest.js');
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-run-manifest-'));
fs.rmSync(tmpDir, { recursive: true, force: true });
const manifestPath = path.join(tmpDir, 'operator-run-manifest.json');

const assurance = cp.spawnSync(process.execPath, [
  ASSURANCE,
  '--request', REQUEST,
  '--policy', POLICY,
  '--source', SOURCE,
  '--client', 'client:manifest-test',
  '--mode', 'local_passive',
  '--run-id', 'operator-scan-assurance-run:ci-run-manifest',
  '--out-dir', tmpDir,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (assurance.status !== 0) fail(`Expected scan assurance success, got ${assurance.status}`, assurance);

const generated = cp.spawnSync(process.execPath, [
  MANIFEST,
  path.join(tmpDir, 'operator-scan-assurance-run.json'),
  '--out', manifestPath,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (generated.status !== 0) fail(`Expected run manifest success, got ${generated.status}`, generated);
const manifest = parseJson(generated.stdout, 'run manifest', generated);

if (manifest.sourceRunId !== 'operator-scan-assurance-run:ci-run-manifest') fail('Unexpected sourceRunId.', generated);
if (manifest.clientRef !== 'client:manifest-test') fail('Unexpected clientRef.', generated);
if (manifest.mode !== 'local_passive') fail('Unexpected mode.', generated);
if (manifest.boundaryFlags.networkAccessAttempted !== false) fail('Expected networkAccessAttempted=false.', generated);
if (manifest.boundaryFlags.scanExecutionPerformed !== false) fail('Expected scanExecutionPerformed=false.', generated);
if (manifest.boundaryFlags.executionAllowed !== false || manifest.boundaryFlags.executionPerformed !== false) fail('Expected execution boundary flags false.', generated);
if (manifest.artifactCount !== manifest.artifacts.length) fail('artifactCount mismatch.', generated);
if (manifest.artifacts.length < 10) fail(`Expected at least 10 artifacts, got ${manifest.artifacts.length}.`, generated);

const ids = new Set();
for (const artifact of manifest.artifacts) {
  if (ids.has(artifact.artifactId)) fail(`Duplicate artifact id ${artifact.artifactId}.`, generated);
  ids.add(artifact.artifactId);
  if (!/^[a-f0-9]{64}$/.test(artifact.sha256)) fail(`Invalid sha256 for ${artifact.artifactId}.`, generated);
  if (artifact.byteLength <= 0) fail(`Expected non-empty artifact ${artifact.artifactId}.`, generated);
}

for (const expected of ['sourceRun', 'policy', 'request', 'plan', 'scanResult', 'scanAssessment', 'surfaceRunIndex', 'operatorWorkflow', 'operatorWorkorders', 'caseIndex', 'dashboard', 'clientReport'].map((item) => item.toLowerCase().replace(/[^a-z0-9._:-]+/g, '-'))) {
  if (!ids.has(expected)) fail(`Missing expected artifact id ${expected}.`, generated);
}

if (!fs.existsSync(manifestPath)) fail('Expected manifest output artifact.', generated);

const sourceRunPath = path.join(tmpDir, 'operator-scan-assurance-run.json');
const sourceRun = parseJson(fs.readFileSync(sourceRunPath, 'utf8'), 'source run file', generated);
sourceRun.clientReportRef = 'missing/client-report.json';
const brokenPath = path.join(tmpDir, 'broken-run.json');
fs.writeFileSync(brokenPath, `${JSON.stringify(sourceRun, null, 2)}\n`, 'utf8');
const missing = cp.spawnSync(process.execPath, [MANIFEST, brokenPath], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (missing.status === 0) fail('Expected missing artifact manifest generation to fail.', missing);
if (!missing.stderr.includes('Missing artifact')) fail('Expected missing artifact error.', missing);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Run manifest tests passed.');
