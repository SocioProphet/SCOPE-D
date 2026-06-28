#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENRICH = path.join(ROOT, 'scripts', 'run-intelligence-enrichment.js');
const DETECT = path.join(ROOT, 'scripts', 'export-detection-candidates.js');
const GRAPH = path.join(ROOT, 'scripts', 'export-cyber-graph.js');
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-graph-'));
const enrichmentPath = path.join(tmpDir, 'intelligence-enrichment.json');
const detectionPath = path.join(tmpDir, 'detection-candidates.json');
const graphDir = path.join(tmpDir, 'graph');

const enriched = cp.spawnSync(process.execPath, [ENRICH, FIXTURE, '--out', enrichmentPath], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (enriched.status !== 0) fail(`Expected enrichment success, got ${enriched.status}`, enriched);

const detected = cp.spawnSync(process.execPath, [DETECT, enrichmentPath, '--out', detectionPath], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (detected.status !== 0) fail(`Expected detection export success, got ${detected.status}`, detected);

const exported = cp.spawnSync(process.execPath, [GRAPH, '--enrichment', enrichmentPath, '--detections', detectionPath, '--out-dir', graphDir], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
if (exported.status !== 0) fail(`Expected graph export success, got ${exported.status}`, exported);
const graph = parseJson(exported.stdout, 'cyber graph export', exported);

if (graph.executionPerformed !== false) fail('Expected no execution.');
if (graph.nodes.length < 10) fail(`Expected at least 10 graph nodes, got ${graph.nodes.length}.`);
if (graph.edges.length < 20) fail(`Expected at least 20 graph edges, got ${graph.edges.length}.`);
for (const key of ['hellgraphStream', 'ontogenesisTurtle', 'sherlockDocuments', 'synapseiqGraphPacket', 'noeticaGraphWorkspace']) {
  if (!graph.exports[key]) fail(`Missing export ${key}.`);
  if (!fs.existsSync(path.join(ROOT, graph.exports[key]))) fail(`Missing exported artifact ${graph.exports[key]}.`);
}
const kinds = new Set(graph.nodes.map((node) => node.kind));
for (const kind of ['indicator', 'provider', 'observation', 'evidence_receipt', 'detection_candidate', 'rule_family', 'attack_technique', 'edge_bastion', 'agent_workflow']) {
  if (!kinds.has(kind)) fail(`Missing node kind ${kind}.`);
}
const predicates = new Set(graph.edges.map((edge) => edge.predicate));
for (const predicate of ['enriched_by', 'produced_receipt', 'produced_observation', 'generated_candidate', 'maps_to_attack', 'uses_rule_family', 'targets_deployment', 'reviewed_by_workflow', 'grounded_in']) {
  if (!predicates.has(predicate)) fail(`Missing edge predicate ${predicate}.`);
}
const sherlock = readJson(path.join(ROOT, graph.exports.sherlockDocuments));
if (sherlock.kind !== 'SherlockGraphDocumentBundle') fail('Unexpected Sherlock graph export kind.');
const synapse = readJson(path.join(ROOT, graph.exports.synapseiqGraphPacket));
if (synapse.kind !== 'SynapseIQGraphPacket') fail('Unexpected SynapseIQ graph packet kind.');
const noetica = readJson(path.join(ROOT, graph.exports.noeticaGraphWorkspace));
if (noetica.kind !== 'NoeticaGraphWorkspace') fail('Unexpected Noetica graph workspace kind.');

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Cyber graph export tests passed.');
