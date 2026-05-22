#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSURANCE = path.join(ROOT, 'scripts', 'run-scan-assurance.js');
const MANIFEST = path.join(ROOT, 'scripts', 'generate-run-manifest.js');
const PACKAGE = path.join(ROOT, 'scripts', 'export-client-evidence-package.js');
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

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-client-package-'));
fs.rmSync(tmpDir, { recursive: true, force: true });
const manifestPath = path.join(tmpDir, 'operator-run-manifest.json');
const packageDir = path.join(tmpDir, 'client-package');

const assurance = cp.spawnSync(process.execPath, [
  ASSURANCE,
  '--request', REQUEST,
  '--policy', POLICY,
  '--source', SOURCE,
  '--client', 'client:package-test',
  '--mode', 'local_passive',
  '--run-id', 'operator-scan-assurance-run:ci-client-package',
  '--out-dir', tmpDir,
], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (assurance.status !== 0) fail(`Expected scan assurance success, got ${assurance.status}`, assurance);

const manifestRun = cp.spawnSync(process.execPath, [MANIFEST, path.join(tmpDir, 'operator-scan-assurance-run.json'), '--out', manifestPath], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (manifestRun.status !== 0) fail(`Expected run manifest success, got ${manifestRun.status}`, manifestRun);
const manifest = parseJson(manifestRun.stdout, 'run manifest', manifestRun);

const packaged = cp.spawnSync(process.execPath, [PACKAGE, manifestPath, '--out-dir', packageDir], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (packaged.status !== 0) fail(`Expected client evidence package success, got ${packaged.status}`, packaged);
const pkg = parseJson(packaged.stdout, 'client evidence package', packaged);

if (pkg.sourceRunId !== 'operator-scan-assurance-run:ci-client-package') fail('Unexpected package sourceRunId.', packaged);
if (pkg.clientRef !== 'client:package-test') fail('Unexpected package clientRef.', packaged);
if (pkg.artifactCount !== manifest.artifactCount) fail('Package artifact count mismatch.', packaged);
if (pkg.boundaryFlags.networkAccessAttempted !== false) fail('Expected package networkAccessAttempted=false.', packaged);
if (pkg.boundaryFlags.scanExecutionPerformed !== false) fail('Expected package scanExecutionPerformed=false.', packaged);
if (!fs.existsSync(path.join(packageDir, 'client-evidence-package.json'))) fail('Expected package index artifact.', packaged);
if (!fs.existsSync(path.join(packageDir, 'client-evidence-package.md'))) fail('Expected package summary artifact.', packaged);

for (const artifact of pkg.artifacts) {
  const packagedPath = path.join(packageDir, artifact.packagePath);
  if (!fs.existsSync(packagedPath)) fail(`Missing packaged artifact ${artifact.packagePath}.`, packaged);
  if (digest(packagedPath) !== artifact.sha256) fail(`Packaged digest mismatch for ${artifact.artifactId}.`, packaged);
}

const sourceRun = path.join(tmpDir, 'operator-scan-assurance-run.json');
fs.appendFileSync(sourceRun, '\n', 'utf8');
const mismatchDir = path.join(tmpDir, 'bad-package');
const mismatch = cp.spawnSync(process.execPath, [PACKAGE, manifestPath, '--out-dir', mismatchDir], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (mismatch.status === 0) fail('Expected digest mismatch package export to fail.', mismatch);
if (!mismatch.stderr.includes('Digest mismatch')) fail('Expected digest mismatch error.', mismatch);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Client evidence package tests passed.');
