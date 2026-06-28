#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RUNNER = path.join(ROOT, 'scripts', 'run-intelligence-enrichment.js');
const FIXTURE = path.join(ROOT, 'examples', 'scope-d', 'intelligence-indicators.example.json');

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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-intel-'));
const out = path.join(tmpDir, 'intelligence-enrichment.json');
const result = cp.spawnSync(process.execPath, [RUNNER, FIXTURE, '--out', out], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (result.status !== 0) fail(`Expected intelligence enrichment success, got ${result.status}`, result);

const enrichment = parseJson(result.stdout, 'intelligence enrichment output', result);
if (!fs.existsSync(out)) fail('Expected intelligence enrichment artifact to be written.');
if (enrichment.executionPerformed !== false) fail('Expected no execution to be performed.');
if (enrichment.mode !== 'fixture') fail('Expected fixture mode.');
if (!enrichment.sourceSet.includes('virustotal')) fail('Missing VirusTotal source lane.');
if (!enrichment.sourceSet.includes('greynoise')) fail('Missing GreyNoise source lane.');
if (!enrichment.sourceSet.includes('cisa_kev')) fail('Missing CISA KEV source lane.');
if (!enrichment.sourceSet.includes('epss')) fail('Missing EPSS source lane.');
if (!enrichment.sourceSet.includes('osv')) fail('Missing OSV source lane.');
if (enrichment.receipts.length < 5) fail(`Expected at least 5 receipts, got ${enrichment.receipts.length}.`);
if (enrichment.observations.length !== enrichment.receipts.length) fail('Expected one observation per receipt.');
if (enrichment.graphEdges.length < enrichment.receipts.length * 3) fail('Expected graph edges for every receipt.');
if (enrichment.receipts.some((receipt) => receipt.liveConnectionUsed !== false || receipt.executionPerformed !== false)) fail('Expected all receipts to remain fixture/no-execution.');

const categories = new Set(enrichment.observations.map((observation) => observation.category));
for (const required of ['malware_reputation', 'internet_noise', 'known_exploited_vulnerability', 'exploit_probability', 'package_vulnerability']) {
  if (!categories.has(required)) fail(`Missing observation category ${required}.`);
}

const edgePredicates = new Set(enrichment.graphEdges.map((edge) => edge.predicate));
for (const required of ['enriched_by', 'observed_as', 'should_generate_detection']) {
  if (!edgePredicates.has(required)) fail(`Missing graph edge predicate ${required}.`);
}

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Intelligence enrichment tests passed.');
