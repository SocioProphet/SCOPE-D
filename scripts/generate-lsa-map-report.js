#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const MAP_PATH = 'config/scope-d-lsa-map.json';
const MAP_SCHEMA_PATH = 'config/schemas/scope-d-lsa-map.schema.json';
const REPORT_SCHEMA_PATH = 'config/schemas/lsa-map-report.schema.json';
const OUT_JSON = 'reports/scope-d-lsa-map-report.json';
const OUT_MD = 'reports/scope-d-lsa-map-report.md';

const IMPLEMENTED_TOPIC_LANES = new Map([
  [1, {
    lanes: ['generic_proof_chain', 'run_receipt', 'artifact_hashes'],
    proofs: ['receipt.json', 'run-summary.json', 'ontogenesis.ttl'],
  }],
  [11, {
    lanes: ['engagement_policy_gate', 'capability_boundary', 'mcp_tool_risk'],
    proofs: ['engagement-policy.json', 'mcp-tool-risk.json', 'proof-artifact.json'],
  }],
  [18, {
    lanes: ['deterministic_reporting', 'receipt_hashes', 'ontogenesis_export'],
    proofs: ['run-summary.json', 'run-summary.md', 'ontogenesis.ttl'],
  }],
  [19, {
    lanes: ['event_ir', 'identity_ir', 'proof_artifact', 'ontogenesis_terms'],
    proofs: ['event-ir.jsonl', 'identity-ir.json', 'proof-artifact.json', 'ontogenesis.ttl'],
  }],
  [20, {
    lanes: ['graph_robustness_assessment', 'graph_path_cost', 'synthetic_edge_injection'],
    proofs: ['graph-robustness-assessment.json', 'proof-artifact.json'],
  }],
]);

const GLOBAL_IMPLEMENTED_LANES = [
  'generic_proof_chain',
  'engagement_policy_gate',
  'event_ir',
  'identity_ir',
  'proof_artifact',
  'ai_infra_synthetic_slice',
  'graph_robustness_synthetic_slice',
  'deterministic_reporting',
  'ontogenesis_export',
];

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
}

function writeJson(relPath, value) {
  const abs = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(relPath, value) {
  const abs = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, value, 'utf8');
}

function createAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function validate(schemaPath, value, label) {
  const ajv = createAjv();
  const schema = readJson(schemaPath);
  const validator = ajv.compile(schema);
  if (!validator(value)) {
    const details = (validator.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
    throw new Error(`${label} failed validation: ${details}`);
  }
}

function missingLanesForTopic(topicId) {
  if (IMPLEMENTED_TOPIC_LANES.has(topicId)) return [];
  return ['proof_artifact_binding', 'domain_runner', 'verified_receipt_export'];
}

function buildReport(map) {
  const now = new Date().toISOString();
  const topicCoverage = map.topics.map((topic) => {
    const implemented = IMPLEMENTED_TOPIC_LANES.get(topic.id);
    return {
      id: topic.id,
      name: topic.name,
      status: implemented ? 'proof_producing' : 'captured_design',
      implementedLanes: implemented ? implemented.lanes : [],
      missingLanes: missingLanesForTopic(topic.id),
      proofArtifacts: implemented ? implemented.proofs : [],
    };
  });

  const implementedTopicCount = topicCoverage.filter((topic) => topic.status === 'proof_producing').length;
  const capturedDesignTopicCount = topicCoverage.length - implementedTopicCount;

  return {
    schemaVersion: '0.1.0',
    reportId: `lsa-report-${map.id.replace(/^scope-d-lsa-map-/, '')}`,
    mapId: map.id,
    generatedAt: now,
    topicCount: map.topics.length,
    implementedTopicCount,
    capturedDesignTopicCount,
    topicCoverage,
    crossTopicEdges: Array.isArray(map.crossTopicEdges) ? map.crossTopicEdges.length : 0,
    summary: {
      implementedLanes: GLOBAL_IMPLEMENTED_LANES,
      capturedDesignLanes: [
        'live_collectors',
        'live_ai_mcp_fingerprinting',
        'live_graph_assessment',
        'policyfabric_admission_controller',
        'sociosphere_dashboard_runtime',
        'frost_quorum',
        'triune_fpgl_memphis_crds',
        'twenty_three_topic_orchestration',
      ],
      notes: [
        'This report is generated from config/scope-d-lsa-map.json.',
        'A topic is marked proof_producing only when it has executable runner/verification/report/export artifacts in the repository.',
        'Captured-design topics remain intentionally non-promoted until backed by schemas, fixtures, runners, verified receipts, and exports.',
      ],
    },
  };
}

function renderMarkdown(report) {
  const rows = report.topicCoverage.map((topic) => {
    const lanes = topic.implementedLanes.length ? topic.implementedLanes.join(', ') : '—';
    const missing = topic.missingLanes.length ? topic.missingLanes.join(', ') : '—';
    const proofs = topic.proofArtifacts.length ? topic.proofArtifacts.join(', ') : '—';
    return `| ${topic.id} | ${topic.name} | ${topic.status} | ${lanes} | ${missing} | ${proofs} |`;
  }).join('\n');

  return [
    '# SCOPE-D 23-topic LSA Map Report',
    '',
    `Report ID: ${report.reportId}`,
    `Map ID: ${report.mapId}`,
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Topics: ${report.topicCount}`,
    `- Proof-producing topics: ${report.implementedTopicCount}`,
    `- Captured-design topics: ${report.capturedDesignTopicCount}`,
    `- Cross-topic edges: ${report.crossTopicEdges}`,
    '',
    '## Implemented lanes',
    '',
    ...report.summary.implementedLanes.map((lane) => `- ${lane}`),
    '',
    '## Captured-design lanes',
    '',
    ...report.summary.capturedDesignLanes.map((lane) => `- ${lane}`),
    '',
    '## Topic coverage',
    '',
    '| ID | Topic | Status | Implemented lanes | Missing lanes | Proof artifacts |',
    '|---:|---|---|---|---|---|',
    rows,
    '',
    '## Notes',
    '',
    ...report.summary.notes.map((note) => `- ${note}`),
    '',
  ].join('\n');
}

function main() {
  const map = readJson(MAP_PATH);
  validate(MAP_SCHEMA_PATH, map, MAP_PATH);
  const report = buildReport(map);
  validate(REPORT_SCHEMA_PATH, report, 'LSA map report');
  writeJson(OUT_JSON, report);
  writeText(OUT_MD, renderMarkdown(report));
  console.log(`Wrote SCOPE-D LSA map report: ${OUT_JSON}`);
  console.log(`Wrote SCOPE-D LSA map report markdown: ${OUT_MD}`);
}

try {
  main();
} catch (err) {
  console.error(`scope-d:report-lsa-map failed: ${err.message}`);
  process.exit(1);
}
