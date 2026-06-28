#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA = 'config/schemas/cyber-graph-export.schema.json';

function usage() {
  console.log('Usage: node scripts/export-cyber-graph.js --enrichment <intelligence-enrichment.json> --detections <detection-candidates.json> --out-dir <dir>');
}
function parseArgs(argv) {
  const args = { enrichment: null, detections: null, outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--enrichment') { args.enrichment = argv[++i]; continue; }
    if (item === '--detections') { args.detections = argv[++i]; continue; }
    if (item === '--out-dir') { args.outDir = argv[++i]; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.enrichment) throw new Error('--enrichment is required.');
  if (!args.detections) throw new Error('--detections is required.');
  if (!args.outDir) throw new Error('--out-dir is required.');
  return args;
}
function abs(file) { return path.isAbsolute(file) ? file : path.join(ROOT, file); }
function rel(file) { return path.relative(ROOT, abs(file)).replace(/\\/g, '/'); }
function readJson(file) { return JSON.parse(fs.readFileSync(abs(file), 'utf8')); }
function writeText(file, value) { const out = abs(file); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, value, 'utf8'); }
function writeJson(file, value) { writeText(file, `${JSON.stringify(value, null, 2)}\n`); }
function slug(value) { return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'node'; }
function hash(value) { return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`; }
function validate(value) {
  const schema = readJson(SCHEMA);
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validator = ajv.compile(schema);
  if (!validator(value)) {
    const details = (validator.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
    throw new Error(`cyber graph export failed schema validation: ${details}`);
  }
}
function addNode(map, nodeId, kind, label, sourceRefs, confidence, payload) {
  if (map.has(nodeId)) return;
  map.set(nodeId, { nodeId, kind, label, sourceRefs, confidence, provenanceHash: hash(payload || { nodeId, kind, label, sourceRefs }) });
}
function edgeId(from, predicate, to) { return `cyber-graph-runtime-edge:${slug(from)}-${slug(predicate)}-${slug(to)}`; }
function addEdge(edges, from, predicate, to, sourceRefs, confidence) {
  edges.push({ edgeId: edgeId(from, predicate, to), from, predicate, to, sourceRefs, confidence });
}
function turtle(graph) {
  const lines = ['@prefix scope: <https://socioprophet.dev/scope-d/> .', '@prefix prov: <http://www.w3.org/ns/prov#> .', ''];
  for (const node of graph.nodes) lines.push(`scope:${slug(node.nodeId)} scope:kind "${node.kind}" ; scope:label "${node.label.replace(/"/g, '\\"')}" .`);
  for (const edge of graph.edges) lines.push(`scope:${slug(edge.from)} scope:${edge.predicate} scope:${slug(edge.to)} .`);
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv);
  const enrichment = readJson(args.enrichment);
  const detections = readJson(args.detections);
  if (enrichment.executionPerformed !== false || detections.executionPerformed !== false) throw new Error('Refusing graph export from executing inputs.');
  const outDir = abs(args.outDir);
  const nodes = new Map();
  const edges = [];

  for (const indicator of enrichment.indicators || []) addNode(nodes, indicator.indicatorId, 'indicator', `${indicator.kind}:${indicator.value}`, [rel(args.enrichment)], 0.8, indicator);
  for (const receipt of enrichment.receipts || []) {
    addNode(nodes, receipt.receiptId, 'evidence_receipt', receipt.provider, [rel(args.enrichment)], 0.9, receipt);
    addNode(nodes, `provider:${receipt.provider}`, 'provider', receipt.provider, [receipt.receiptId], 0.85, receipt);
    addEdge(edges, receipt.indicatorRef, 'produced_receipt', receipt.receiptId, [receipt.receiptId], 0.9);
    addEdge(edges, receipt.indicatorRef, 'enriched_by', `provider:${receipt.provider}`, [receipt.receiptId], 0.85);
  }
  for (const observation of enrichment.observations || []) {
    addNode(nodes, observation.observationId, 'observation', observation.category, observation.evidenceRefs, observation.confidence, observation);
    addEdge(edges, observation.indicatorRef, 'produced_observation', observation.observationId, observation.evidenceRefs, observation.confidence);
    for (const evidenceRef of observation.evidenceRefs) addEdge(edges, observation.observationId, 'grounded_in', evidenceRef, [evidenceRef], observation.confidence);
  }
  addNode(nodes, 'edge-bastion:cloudshell-fog', 'edge_bastion', 'CloudShell Fog', [rel(args.detections)], 0.8, detections.cloudshellFog);
  addNode(nodes, 'agent-workflow:whiterabbitneo-defensive-review', 'agent_workflow', 'WhiteRabbitNeo defensive review', [rel(args.detections)], 0.8, detections.whiteRabbitNeoWorkflow);
  for (const candidate of detections.candidates || []) {
    addNode(nodes, candidate.candidateId, 'detection_candidate', candidate.title, [rel(args.detections), candidate.sourceObservationRef], candidate.provenance.confidence, candidate);
    addNode(nodes, `rule-family:${candidate.family}`, 'rule_family', candidate.family, [candidate.candidateId], 0.8, candidate);
    addNode(nodes, `deployment-target:${candidate.deployment.target}`, 'deployment_target', candidate.deployment.target, [candidate.candidateId], 0.8, candidate.deployment);
    addEdge(edges, candidate.sourceObservationRef, 'generated_candidate', candidate.candidateId, candidate.sourceEvidenceRefs, candidate.provenance.confidence);
    addEdge(edges, candidate.candidateId, 'uses_rule_family', `rule-family:${candidate.family}`, [candidate.candidateId], 0.8);
    addEdge(edges, candidate.candidateId, 'targets_deployment', `deployment-target:${candidate.deployment.target}`, [candidate.candidateId], 0.8);
    addEdge(edges, candidate.candidateId, 'reviewed_by_workflow', 'agent-workflow:whiterabbitneo-defensive-review', [candidate.candidateId], 0.8);
    if (candidate.deployment.cloudshellFogEligible) addEdge(edges, candidate.candidateId, 'eligible_for_edge_bastion', 'edge-bastion:cloudshell-fog', [candidate.candidateId], 0.8);
    for (const attack of candidate.attackMappings) {
      addNode(nodes, `attack:${attack}`, 'attack_technique', attack, [candidate.candidateId], 0.75, { attack });
      addEdge(edges, candidate.candidateId, 'maps_to_attack', `attack:${attack}`, [candidate.candidateId], 0.75);
    }
  }

  const graphId = `cyber-graph-export:${slug(enrichment.enrichmentId.replace(/^intelligence-enrichment:/, ''))}`;
  const hellgraphPath = path.join(outDir, 'hellgraph-stream.jsonl');
  const turtlePath = path.join(outDir, 'ontogenesis-cyber-graph.ttl');
  const sherlockPath = path.join(outDir, 'sherlock-graph-documents.json');
  const synapsePath = path.join(outDir, 'synapseiq-graph-packet.json');
  const noeticaPath = path.join(outDir, 'noetica-graph-workspace.json');
  const graph = {
    schemaVersion: '0.1.0',
    graphExportId: graphId,
    generatedAt: new Date().toISOString(),
    sourceRefs: [rel(args.enrichment), rel(args.detections)],
    nodes: Array.from(nodes.values()),
    edges,
    exports: { hellgraphStream: rel(hellgraphPath), ontogenesisTurtle: rel(turtlePath), sherlockDocuments: rel(sherlockPath), synapseiqGraphPacket: rel(synapsePath), noeticaGraphWorkspace: rel(noeticaPath) },
    executionPerformed: false,
  };
  validate(graph);
  writeText(hellgraphPath, `${graph.nodes.map((n) => JSON.stringify({ type: 'node', ...n })).join('\n')}\n${graph.edges.map((e) => JSON.stringify({ type: 'edge', ...e })).join('\n')}\n`);
  writeText(turtlePath, turtle(graph));
  writeJson(sherlockPath, { schemaVersion: '0.1.0', kind: 'SherlockGraphDocumentBundle', graphExportId: graph.graphExportId, documents: graph.nodes.map((n) => ({ documentId: n.nodeId, documentType: n.kind, text: `${n.kind} ${n.label}`, sourceRefs: n.sourceRefs })) });
  writeJson(synapsePath, { schemaVersion: '0.1.0', kind: 'SynapseIQGraphPacket', graphExportId: graph.graphExportId, nodeCount: graph.nodes.length, edgeCount: graph.edges.length, claimBoundary: 'graph_claims_must_resolve_to_receipts_or_candidates' });
  writeJson(noeticaPath, { schemaVersion: '0.1.0', kind: 'NoeticaGraphWorkspace', graphExportId: graph.graphExportId, sections: [{ id: 'nodes', count: graph.nodes.length }, { id: 'edges', count: graph.edges.length }, { id: 'detections', count: detections.candidates.length }] });
  writeJson(path.join(outDir, 'cyber-graph-export.json'), graph);
  process.stdout.write(`${JSON.stringify(graph, null, 2)}\n`);
}

try { main(); } catch (err) { console.error(`export-cyber-graph failed: ${err.message}`); process.exit(1); }
