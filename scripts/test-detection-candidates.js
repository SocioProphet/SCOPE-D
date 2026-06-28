#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENRICH = path.join(ROOT, 'scripts', 'run-intelligence-enrichment.js');
const EXPORT = path.join(ROOT, 'scripts', 'export-detection-candidates.js');
const FIXTURE = path.join(ROOT, 'examples', 'scope-d', 'intelligence-indicators.example.json');

function fail(message, result) {
  console.error(message);
  if (result && result.stderr) console.error(result.stderr);
  if (result && result.stdout) console.error(result.stdout);
  process.exit(1);
}
function parseJson(text, label, result) {
  try { return JSON.parse(text); } catch (err) { fail(`${label}: expected JSON output: ${err.message}`, result); }
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-detections-'));
const enrichmentPath = path.join(tmpDir, 'intelligence-enrichment.json');
const detectionPath = path.join(tmpDir, 'detection-candidates.json');

const enriched = cp.spawnSync(process.execPath, [ENRICH, FIXTURE, '--out', enrichmentPath], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (enriched.status !== 0) fail(`Expected intelligence enrichment success, got ${enriched.status}`, enriched);

const exported = cp.spawnSync(process.execPath, [EXPORT, enrichmentPath, '--out', detectionPath], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (exported.status !== 0) fail(`Expected detection candidate export success, got ${exported.status}`, exported);
const detections = parseJson(exported.stdout, 'detection candidate export', exported);

if (!fs.existsSync(detectionPath)) fail('Expected detection candidate artifact.');
if (detections.executionPerformed !== false) fail('Detection export must not perform execution.');
if (detections.cloudshellFog.role !== 'authorized_edge_operator_bastion') fail('CloudShell Fog role boundary not preserved.');
if (!detections.cloudshellFog.allowedModes.includes('mesh_edge_assurance')) fail('CloudShell Fog mesh edge assurance mode missing.');
if (!detections.cloudshellFog.prohibitedModes.includes('payload_execution')) fail('CloudShell Fog prohibited payload execution mode missing.');
if (detections.whiteRabbitNeoWorkflow.role !== 'defensive_detection_review_assistant') fail('WhiteRabbitNeo workflow role mismatch.');
if (!detections.whiteRabbitNeoWorkflow.blockedUse.includes('evasion_guidance')) fail('WhiteRabbitNeo blocked-use boundary missing.');

const families = new Set(detections.candidates.map((candidate) => candidate.family));
for (const required of ['sigma', 'yara', 'osquery', 'opa_rego', 'suricata', 'github_policy', 'sourceos_policy']) {
  if (!families.has(required)) fail(`Missing detection family ${required}.`);
}

const attackMapped = detections.candidates.every((candidate) => candidate.attackMappings.length > 0 && candidate.attackMappings.every((mapping) => mapping.startsWith('ATT&CK:T')));
if (!attackMapped) fail('Every detection candidate must carry ATT&CK mapping.');

const safeDeployment = detections.candidates.every((candidate) => candidate.deployment.requiresOperatorApproval === true && candidate.deployment.executionAllowed === false && candidate.deployment.executionPerformed === false);
if (!safeDeployment) fail('Every detection candidate must be approval-gated and non-executing.');

const grounded = detections.candidates.every((candidate) => candidate.provenance.grounding.includes(candidate.sourceObservationRef));
if (!grounded) fail('Every detection candidate must be grounded in its source observation.');

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Detection candidate tests passed.');
