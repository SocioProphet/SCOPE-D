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
  process.exit(1);
}
function parseJson(text, label, result) {
  try { return JSON.parse(text); } catch (err) { fail(`${label}: expected JSON output: ${err.message}`, result); }
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-detections-'));
const enrichmentPath = path.join(tmpDir, 'intelligence-enrichment.json');
const detectionPath = path.join(tmpDir, 'detection-candidates.json');

const enriched = cp.spawnSync(process.execPath, [ENRICH, FIXTURE, '--out', enrichmentPath], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (enriched.status !== 0) fail(`Expected enrichment success, got ${enriched.status}`, enriched);

const exported = cp.spawnSync(process.execPath, [EXPORT, enrichmentPath, '--out', detectionPath], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (exported.status !== 0) fail(`Expected detection export success, got ${exported.status}`, exported);
const detections = parseJson(exported.stdout, 'detection candidate export', exported);

if (!fs.existsSync(detectionPath)) fail('Expected detection candidate artifact.');
if (detections.executionPerformed !== false) fail('Expected no execution.');
if (detections.candidates.length < 8) fail(`Expected at least 8 detection candidates, got ${detections.candidates.length}.`);
for (const family of ['sigma', 'yara', 'osquery', 'opa_rego', 'suricata', 'github_policy', 'sourceos_policy']) {
  if (!detections.ruleFamilies.includes(family)) fail(`Missing rule family ${family}.`);
}
if (detections.candidates.some((candidate) => candidate.deployment.requiresOperatorApproval !== true)) fail('Every candidate must require operator approval.');
if (detections.candidates.some((candidate) => candidate.deployment.executionAllowed !== false || candidate.deployment.executionPerformed !== false)) fail('Detection candidates must remain non-executing.');
if (!detections.candidates.some((candidate) => candidate.deployment.cloudshellFogEligible === true)) fail('Expected at least one CloudShell Fog eligible candidate.');
if (detections.cloudshellFog.role !== 'authorized_edge_operator_bastion') fail('Unexpected CloudShell Fog role.');
if (!detections.cloudshellFog.prohibitedModes.includes('payload_execution')) fail('CloudShell Fog prohibited modes must block payload execution.');
if (detections.whiteRabbitNeoWorkflow.role !== 'defensive_detection_review_assistant') fail('Unexpected WhiteRabbitNeo workflow role.');
if (!detections.whiteRabbitNeoWorkflow.blockedUse.includes('evasion_guidance')) fail('WhiteRabbitNeo workflow must block evasion guidance.');
if (detections.candidates.some((candidate) => candidate.provenance.modelAssistance !== 'whiterabbitneo_defensive_review')) fail('Expected WhiteRabbitNeo defensive review provenance.');

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Detection candidate export tests passed.');
