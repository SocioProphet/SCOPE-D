#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'scripts', 'scope-d.js');

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

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-product-cli-'));
fs.rmSync(outDir, { recursive: true, force: true });

const result = cp.spawnSync(process.execPath, [CLI, 'demo:scan', '--out-dir', outDir, '--client', 'client:product-cli-test'], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: 'pipe',
});

if (result.status !== 0) fail(`Expected product CLI demo success, got ${result.status}`, result);
const payload = parseJson(result.stdout, 'product CLI payload', result);

if (payload.product !== 'scope-d-demo-scan') fail('Unexpected product payload name.', result);
if (payload.status !== 'complete') fail('Expected complete product demo status.', result);
if (payload.clientRef !== 'client:product-cli-test') fail('Unexpected clientRef.', result);

for (const refName of ['assuranceRunRef', 'runManifestRef', 'clientEvidencePackageRef', 'redactedEvidencePackageRef']) {
  if (!payload[refName]) fail(`Missing ${refName}.`, result);
  if (!fs.existsSync(path.join(ROOT, payload[refName]))) fail(`Referenced artifact does not exist: ${payload[refName]}.`, result);
}

const redacted = JSON.parse(fs.readFileSync(path.join(ROOT, payload.redactedEvidencePackageRef), 'utf8'));
if (redacted.clientRef !== 'client:product-cli-test') fail('Unexpected redacted package clientRef.', result);
if (redacted.boundaryFlags.executionPerformed !== false) fail('Expected redacted package executionPerformed=false.', result);
if (!Array.isArray(redacted.artifacts) || redacted.artifacts.length === 0) fail('Expected redacted package artifacts.', result);

const help = cp.spawnSync(process.execPath, [CLI, '--help'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (help.status !== 0) fail('Expected CLI help success.', help);
if (!help.stdout.includes('SCOPE-D operator CLI')) fail('Expected help output to identify operator CLI.', help);
if (!help.stdout.includes('demo:scan')) fail('Expected help output to document demo:scan.', help);

fs.rmSync(outDir, { recursive: true, force: true });
console.log('Product CLI tests passed.');
