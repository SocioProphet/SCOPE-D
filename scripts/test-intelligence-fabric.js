#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENRICH = path.join(ROOT, 'scripts', 'enrich-indicators.js');
const EXPORT_GRAPH = path.join(ROOT, 'scripts', 'export-intelligence-graph.js');
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
const enrichmentPath = path.join(tmpDir, 'intelligence-enrichment.json');
const graphPath = path.join(tmpDir, 'intelligence-graph.json');

const enriched = cp.spawnSync(process.execPath, [ENRICH, FIXTURE, '--out', enrichmentPath], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (enriched.status !== 0) fail(`Expected intelligence enrichment success, got ${enriched.status}`, enriched);
const enrichment = parseJson(enriched.stdout, 'enrichment output', enriched);
if (enrichment.executionPerformed !== false) fail('Expected executionPerformed=false on enrichment.', enriched);
if (enrichment.mode !== 'fixture') fail('Expected fixture mode.', enriched);
if (!Array.isArray(enrichment.receipts) || enrichment.receipts.length < 5) fail('Expected partner intelligence receipts.', enriched);
if (!Array.isArray(enrichment.observations) || enrichment.observations.length < 5) fail('Expected partner intelligence observations.', enriched);
if (!Array.isArray(enrichment.graphEdges) || enrichment.graphEdges.length < enrichment.observations.length) fail('Expected graph edges for observations.', enriched);
if (enrichment.receipts.some((receipt) => receipt.liveConnectionUsed !== false || receipt.executionPerformed !== false)) fail('Expected no live connection or execution in receipts.', enriched);

const providers = new Set(enrichment.receipts.map((receipt) => receipt.provider));
for (const provider of ['virustotal', 'greynoise', 'cisa_kev', 'epss', 'osv']) {
  if (!providers.has(provider)) fail(`Missing provider receipt for ${provider}.`, enriched);
}

const graphed = cp.spawnSync(process.execPath, [EXPORT_GRAPH, enrichmentPath, '--out', graphPath], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (graphed.status !== 0) fail(`Expected intelligence graph export success, got ${graphed.status}`, graphed);
const graph = parseJson(graphed.stdout, 'graph output', graphed);
if (graph.executionPerformed !== false) fail('Expected executionPerformed=false on graph export.', graphed);
if (!Array.isArray(graph.nodes) || graph.nodes.length < enrichment.indicators.length) fail('Expected graph nodes.', graphed);
if (!Array.isArray(graph.edges) || graph.edges.length !== enrichment.graphEdges.length) fail('Expected graph edges to match enrichment.', graphed);
if (!fs.existsSync(enrichmentPath) || !fs.existsSync(graphPath)) fail('Expected enrichment and graph artifacts.', graphed);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Intelligence fabric tests passed.');
