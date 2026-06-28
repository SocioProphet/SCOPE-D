#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function usage() {
  console.log('Usage: node scripts/export-intelligence-handoffs.js <intelligence-enrichment.json> --out-dir <dir>');
}

function parseArgs(argv) {
  const args = { input: null, outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--out-dir') { args.outDir = argv[++i]; continue; }
    if (!args.input) { args.input = item; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.input) throw new Error('Missing intelligence enrichment path.');
  if (!args.outDir) throw new Error('--out-dir is required.');
  return args;
}
function abs(file) { return path.isAbsolute(file) ? file : path.join(ROOT, file); }
function readJson(file) { return JSON.parse(fs.readFileSync(abs(file), 'utf8')); }
function writeJson(file, value) {
  const out = abs(file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function rel(file) { return path.relative(ROOT, abs(file)).replace(/\\/g, '/'); }

function main() {
  const args = parseArgs(process.argv);
  const enrichment = readJson(args.input);
  const outDir = abs(args.outDir);
  const sourceRef = rel(args.input);

  if (enrichment.executionPerformed !== false) throw new Error('Refusing handoff export from enrichment that performed execution.');

  const synapseiq = {
    schemaVersion: '0.1.0',
    kind: 'SynapseIQEnrichmentInput',
    sourceRef,
    enrichmentId: enrichment.enrichmentId,
    generatedAt: new Date().toISOString(),
    observations: enrichment.observations.map((observation) => ({
      observationId: observation.observationId,
      category: observation.category,
      severity: observation.severity,
      confidence: observation.confidence,
      groundedSummary: observation.summary,
      evidenceRefs: observation.evidenceRefs,
    })),
    claimBoundary: 'grounded_receipt_backed_synthesis_only',
    executionAllowed: false,
  };

  const sherlock = {
    schemaVersion: '0.1.0',
    kind: 'SherlockSearchDocumentBundle',
    sourceRef,
    enrichmentId: enrichment.enrichmentId,
    documents: [
      ...enrichment.indicators.map((indicator) => ({ documentId: indicator.indicatorId, documentType: 'indicator', text: `${indicator.kind} ${indicator.value}`, tags: [indicator.kind, indicator.redactionState] })),
      ...enrichment.observations.map((observation) => ({ documentId: observation.observationId, documentType: 'intelligence_observation', text: `${observation.provider} ${observation.category} ${observation.severity} ${observation.summary}`, tags: [observation.provider, observation.category, observation.severity] })),
    ],
  };

  const orion = {
    schemaVersion: '0.1.0',
    kind: 'OrionFieldSignalBundle',
    sourceRef,
    enrichmentId: enrichment.enrichmentId,
    signals: enrichment.graphEdges.map((edge) => ({
      signalId: edge.edgeId.replace(/^cyber-graph-edge:/, 'orion-field-signal:'),
      from: edge.from,
      relation: edge.predicate,
      to: edge.to,
      confidence: edge.confidence,
      sourceRefs: edge.sourceRefs,
    })),
  };

  const noetica = {
    schemaVersion: '0.1.0',
    kind: 'NoeticaCaseWorkspaceSeed',
    sourceRef,
    enrichmentId: enrichment.enrichmentId,
    workspaceSections: [
      { sectionId: 'summary', title: 'Intelligence Summary', itemCount: enrichment.observations.length },
      { sectionId: 'evidence', title: 'Receipts', itemCount: enrichment.receipts.length },
      { sectionId: 'graph', title: 'Graph Edges', itemCount: enrichment.graphEdges.length },
      { sectionId: 'detections', title: 'Detection Candidates', itemCount: enrichment.graphEdges.filter((edge) => edge.predicate === 'should_generate_detection').length },
    ],
    executionAllowed: false,
    executionPerformed: false,
  };

  const outputs = {
    synapseiq: path.join(outDir, 'synapseiq-enrichment-input.json'),
    sherlock: path.join(outDir, 'sherlock-search-documents.json'),
    orion: path.join(outDir, 'orion-field-signals.json'),
    noetica: path.join(outDir, 'noetica-case-workspace-seed.json'),
  };
  writeJson(outputs.synapseiq, synapseiq);
  writeJson(outputs.sherlock, sherlock);
  writeJson(outputs.orion, orion);
  writeJson(outputs.noetica, noetica);

  process.stdout.write(`${JSON.stringify({ schemaVersion: '0.1.0', kind: 'IntelligenceHandoffIndex', sourceRef, outputs: Object.fromEntries(Object.entries(outputs).map(([k, v]) => [k, rel(v)])) }, null, 2)}\n`);
}

try { main(); } catch (err) { console.error(`export-intelligence-handoffs failed: ${err.message}`); process.exit(1); }
