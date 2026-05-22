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
const REDACT = path.join(ROOT, 'scripts', 'redact-client-evidence.js');
const REQUEST = path.join(ROOT, 'examples', 'scope-d', 'operator-scan-request.example.json');
const POLICY = path.join(ROOT, 'examples', 'scope-d', 'operator-scan-policy.example.json');
const SOURCE = path.join(ROOT, 'fixtures', 'synthetic', 'operator-local-passive-scan-source.web-endpoint.synthetic.json');
const PROFILE = path.join(ROOT, 'examples', 'scope-d', 'redaction-profile.client-safe.example.json');

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

function run(label, args) {
  const result = cp.spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) fail(`${label} failed with ${result.status}`, result);
  return result;
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-redaction-'));
fs.rmSync(tmpDir, { recursive: true, force: true });
const manifestPath = path.join(tmpDir, 'operator-run-manifest.json');
const packageDir = path.join(tmpDir, 'client-package');
const redactedDir = path.join(tmpDir, 'redacted-package');

run('scan assurance', [
  ASSURANCE,
  '--request', REQUEST,
  '--policy', POLICY,
  '--source', SOURCE,
  '--client', 'client:redaction-test',
  '--mode', 'local_passive',
  '--run-id', 'operator-scan-assurance-run:ci-redaction-package',
  '--out-dir', tmpDir,
]);
run('run manifest', [MANIFEST, path.join(tmpDir, 'operator-scan-assurance-run.json'), '--out', manifestPath]);
run('client package', [PACKAGE, manifestPath, '--out-dir', packageDir]);

const packageIndexPath = path.join(packageDir, 'client-evidence-package.json');
const packageIndex = parseJson(fs.readFileSync(packageIndexPath, 'utf8'), 'client evidence package');
const clientReport = packageIndex.artifacts.find((artifact) => artifact.artifactType === 'client_report');
if (!clientReport) fail('Expected client_report artifact in package.');
const clientReportPath = path.join(packageDir, clientReport.packagePath);
fs.appendFileSync(clientReportPath, '\n{"authorization":"Bearer abcdefghijklmnopqrstuvwxyz012345","cookie":"sessionid=secretcookievalue","internal":"api.internal","ip":"10.1.2.3","banner":"synthetic-server/0.1","api_key":"abc123456789secret"}\n', 'utf8');
clientReport.sha256 = digest(clientReportPath);
clientReport.byteLength = fs.readFileSync(clientReportPath).length;
fs.writeFileSync(packageIndexPath, `${JSON.stringify(packageIndex, null, 2)}\n`, 'utf8');

const redacted = run('redacted package', [REDACT, '--package', packageIndexPath, '--profile', PROFILE, '--out-dir', redactedDir]);
const redactedIndex = parseJson(redacted.stdout, 'redacted evidence package', redacted);

if (redactedIndex.clientRef !== 'client:redaction-test') fail('Unexpected redacted package clientRef.', redacted);
if (redactedIndex.boundaryFlags.executionPerformed !== false) fail('Expected redacted package executionPerformed=false.', redacted);
if (redactedIndex.artifactCount !== redactedIndex.artifacts.length) fail('Redacted artifact count mismatch.', redacted);
if (!redactedIndex.withheldArtifacts.some((artifact) => artifact.artifactType === 'source_run')) fail('Expected source_run artifact to be withheld.', redacted);
if (!fs.existsSync(path.join(redactedDir, 'redacted-evidence-package.json'))) fail('Expected redacted package index artifact.', redacted);
if (!fs.existsSync(path.join(redactedDir, 'redacted-evidence-package.md'))) fail('Expected redacted package summary artifact.', redacted);

const redactedClientReport = redactedIndex.artifacts.find((artifact) => artifact.artifactType === 'client_report');
if (!redactedClientReport) fail('Expected redacted client_report artifact.', redacted);
if (redactedClientReport.redactionApplied !== true) fail('Expected redactionApplied=true for client_report.', redacted);
const redactedClientText = fs.readFileSync(path.join(redactedDir, redactedClientReport.redactedPackagePath), 'utf8');
for (const forbidden of ['abcdefghijklmnopqrstuvwxyz012345', 'secretcookievalue', 'api.internal', '10.1.2.3', 'synthetic-server/0.1', 'abc123456789secret']) {
  if (redactedClientText.includes(forbidden)) fail(`Redacted client report still contains ${forbidden}.`, redacted);
}
for (const expected of ['[REDACTED_AUTHORIZATION_HEADER]', '[REDACTED_COOKIE]', '[REDACTED_INTERNAL_HOSTNAME]', '[REDACTED_PRIVATE_IP]', '[REDACTED_BANNER]', '[REDACTED_SECRET_LIKE_VALUE]']) {
  if (!redactedClientText.includes(expected)) fail(`Redacted client report missing ${expected}.`, redacted);
}
if (digest(path.join(redactedDir, redactedClientReport.redactedPackagePath)) !== redactedClientReport.sha256) fail('Redacted client report digest mismatch.', redacted);

const mismatchDir = path.join(tmpDir, 'redaction-mismatch');
fs.appendFileSync(clientReportPath, '\nmutation after package index\n', 'utf8');
const mismatch = cp.spawnSync(process.execPath, [REDACT, '--package', packageIndexPath, '--profile', PROFILE, '--out-dir', mismatchDir], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (mismatch.status === 0) fail('Expected redaction to fail on source digest mismatch.', mismatch);
if (!mismatch.stderr.includes('Source package digest mismatch')) fail('Expected source package digest mismatch error.', mismatch);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Redaction profile tests passed.');
