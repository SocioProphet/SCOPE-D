#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENRICH = path.join(ROOT, 'scripts', 'run-intelligence-enrichment.js');
const EXPORT = path.join(ROOT, 'scripts', 'export-intelligence-handoffs.js');
const FIXTURE = path.join(ROOT, 'examples', 'scope-d', 'intelligence-indicators.example.json');

function fail(message, result) {
  console.error(message);
  if (result && result.stderr) console.error(result.stderr);
  process.exit(1);
}
function parseJson(text, label, result) {
  try { return JSON.parse(text); } catch (err) { fail(`${label}: expected JSON output: ${err.message}`, result); }
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-intel-handoffs-'));
const enrichmentPath = path.join(tmpDir, 'intelligence-enrichment.json');
const handoffDir = path.join(tmpDir, 'handoffs');

const enriched = cp.spawnSync(process.execPath, [ENRICH, FIXTURE, '--out', enrichmentPath], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (enriched.status !== 0) fail(`Expected intelligence enrichment success, got ${enriched.status}`, enriched);

const exported = cp.spawnSync(process.execPath, [EXPORT, enrichmentPath, '--out-dir', handoffDir], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (exported.status !== 0) fail(`Expected intelligence handoff export success, got ${exported.status}`, exported);
const index = parseJson(exported.stdout, 'handoff index', exported);

for (const key of ['synapseiq', 'sherlock', 'orion', 'noetica']) {
  if (!index.outputs[key]) fail(`Missing handoff output ${key}.`);
  if (!fs.existsSync(path.join(ROOT, index.outputs[key]))) fail(`Missing handoff artifact ${index.outputs[key]}.`);
}

const synapseiq = readJson(path.join(ROOT, index.outputs.synapseiq));
if (synapseiq.kind !== 'SynapseIQEnrichmentInput') fail('Unexpected SynapseIQ handoff kind.');
if (synapseiq.claimBoundary !== 'grounded_receipt_backed_synthesis_only') fail('SynapseIQ handoff must be receipt-grounded.');
if (synapseiq.executionAllowed !== false) fail('SynapseIQ handoff must remain advisory.');

const sherlock = readJson(path.join(ROOT, index.outputs.sherlock));
if (sherlock.kind !== 'SherlockSearchDocumentBundle') fail('Unexpected Sherlock handoff kind.');
if (sherlock.documents.length === 0) fail('Expected Sherlock documents.');

const orion = readJson(path.join(ROOT, index.outputs.orion));
if (orion.kind !== 'OrionFieldSignalBundle') fail('Unexpected Orion handoff kind.');
if (orion.signals.length === 0) fail('Expected Orion field signals.');

const noetica = readJson(path.join(ROOT, index.outputs.noetica));
if (noetica.kind !== 'NoeticaCaseWorkspaceSeed') fail('Unexpected Noetica handoff kind.');
if (noetica.executionAllowed !== false) fail('Noetica handoff must remain advisory.');

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Intelligence handoff tests passed.');
