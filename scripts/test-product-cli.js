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

const capability = cp.spawnSync(process.execPath, [CLI, 'capability:status'], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: 'pipe',
});

if (capability.status !== 0) fail(`Expected capability status success, got ${capability.status}`, capability);
const capabilityPayload = parseJson(capability.stdout, 'capability status payload', capability);
if (capabilityPayload.product !== 'scope-d-capability-status') fail('Unexpected capability status product name.', capability);
if (capabilityPayload.capabilityCount !== 6) fail(`Expected 6 D capabilities, got ${capabilityPayload.capabilityCount}.`, capability);

const byClass = new Map(capabilityPayload.capabilities.map((item) => [item.class, item]));
for (const className of ['live_target_action', 'network_access', 'credential_access', 'payload_delivery', 'mutation', 'destructive_behavior']) {
  const item = byClass.get(className);
  if (!item) fail(`Missing capability class ${className}.`, capability);
  if (!item.currentMaturity) fail(`Missing maturity for ${className}.`, capability);
  if (!item.productState) fail(`Missing product state for ${className}.`, capability);
  if (!Array.isArray(item.requiredGates)) fail(`Missing gates for ${className}.`, capability);
  if (!Array.isArray(item.requiredEvidence)) fail(`Missing evidence for ${className}.`, capability);
  if (!Array.isArray(item.blockedActions) || item.blockedActions.length === 0) fail(`Missing blocked actions for ${className}.`, capability);
  if (!item.nextPromotion) fail(`Missing next promotion for ${className}.`, capability);
}

if (byClass.get('live_target_action').currentMaturity !== 'D4') fail('Expected live_target_action at D4.', capability);
if (byClass.get('network_access').currentMaturity !== 'D4') fail('Expected network_access at D4.', capability);
for (const blockedClass of ['credential_access', 'payload_delivery', 'mutation', 'destructive_behavior']) {
  if (byClass.get(blockedClass).currentMaturity !== 'D0') fail(`Expected ${blockedClass} at D0.`, capability);
}
if (!byClass.get('mutation').blockedActions.includes('direct_write')) fail('Expected mutation to block direct_write.', capability);
if (!byClass.get('payload_delivery').blockedActions.includes('exploit_payload')) fail('Expected payload delivery to block exploit_payload.', capability);
if (!capabilityPayload.nonClaims.some((claim) => claim.includes('Capability recognition is not authorization'))) fail('Expected capability non-claims.', capability);

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
if (!help.stdout.includes('capability:status')) fail('Expected help output to document capability:status.', help);

fs.rmSync(outDir, { recursive: true, force: true });
console.log('Product CLI tests passed.');
