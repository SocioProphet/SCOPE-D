#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function usage() {
  console.log('Usage: node scripts/export-intelligence-graph.js <intelligence-enrichment.json> [--out <graph.json>]');
}

function parseArgs(argv) {
  const args = { input: null, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--out') { args.out = argv[++i]; continue; }
    if (!args.input) { args.input = item; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.input) throw new Error('Missing intelligence enrichment path.');
  return args;
}

function abs(file) { return path.isAbsolute(file) ? file : path.join(ROOT, file); }
function readJson(file) { return JSON.parse(fs.readFileSync(abs(file), 'utf8')); }
function writeJson(file, value) {
  const out = abs(file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function node(id, kind, props = {}) { return { id, kind, ...props }; }

function main() {
  const args = parseArgs(process.argv);
  const enrichment = readJson(args.input);
  if (!Array.isArray(enrichment.indicators) || !Array.isArray(enrichment.graphEdges)) throw new Error('Invalid intelligence enrichment input.');
  const nodes = new Map();
  for (const indicator of enrichment.indicators) nodes.set(indicator.indicatorId, node(indicator.indicatorId, `indicator:${indicator.kind}`, { value: indicator.value, redactionState: indicator.redactionState }));
  for (const receipt of enrichment.receipts || []) nodes.set(receipt.receiptId, node(receipt.receiptId, 'intelligence_receipt', { provider: receipt.provider, evidenceHash: receipt.evidenceHash }));
  for (const observation of enrichment.observations || []) nodes.set(observation.observationId, node(observation.observationId, 'intelligence_observation', { provider: observation.provider, category: observation.category, severity: observation.severity, confidence: observation.confidence }));
  for (const edge of enrichment.graphEdges) {
    if (!nodes.has(edge.from)) nodes.set(edge.from, node(edge.from, 'external_ref'));
    if (!nodes.has(edge.to)) nodes.set(edge.to, node(edge.to, edge.to.startsWith('provider:') ? 'provider' : 'intelligence_category'));
  }
  const graph = {
    schemaVersion: '0.1.0',
    graphId: enrichment.enrichmentId.replace(/^intelligence-enrichment:/, 'intelligence-graph:'),
    sourceEnrichmentRef: enrichment.enrichmentId,
    generatedAt: new Date().toISOString(),
    nodes: Array.from(nodes.values()).sort((a, b) => a.id.localeCompare(b.id)),
    edges: enrichment.graphEdges,
    executionPerformed: false,
  };
  if (args.out) writeJson(args.out, graph);
  process.stdout.write(`${JSON.stringify(graph, null, 2)}\n`);
}

try { main(); } catch (err) { console.error(`export-intelligence-graph failed: ${err.message}`); process.exit(1); }
