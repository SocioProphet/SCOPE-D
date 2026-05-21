#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const RUN_INDEX_SCHEMA = 'config/schemas/surface-assessment-run-index.schema.json';
const WORKFLOW_SCHEMA = 'config/schemas/operator-workflow-run.schema.json';
const TRIAGE_SCHEMA = 'config/schemas/operator-triage-decision.schema.json';
const WORKORDER_SCHEMA = 'config/schemas/operator-workorder.schema.json';

function usage() {
  console.log('Usage: node scripts/operator-intake.js <surface-run-index.json> [--out-dir <dir>]');
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
  if (!args.input) throw new Error('Missing surface-run-index path.');
  return args;
}

function abs(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT, file);
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(abs(file), 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function validate(schemaRel, value, label) {
  const schema = readJson(schemaRel);
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validator = ajv.compile(schema);
  if (!validator(value)) {
    const details = (validator.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
    throw new Error(`${label} failed schema validation: ${details}`);
  }
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'operator';
}

function triageFor(index) {
  if (index.riskLevel === 'critical') {
    return {
      status: 'remediation_required',
      decision: 'remediation_required',
      queue: 'critical',
      approvalRequired: true,
      reason: 'Critical surface assessment requires remediation planning and approval before any live action.',
    };
  }
  if (index.riskLevel === 'high') {
    return {
      status: 'remediation_required',
      decision: 'remediation_required',
      queue: 'high',
      approvalRequired: false,
      reason: 'High-risk surface assessment requires remediation planning.',
    };
  }
  if (index.riskLevel === 'medium') {
    return {
      status: 'needs_review',
      decision: 'needs_review',
      queue: 'review',
      approvalRequired: false,
      reason: 'Medium-risk surface assessment requires operator review.',
    };
  }
  return {
    status: 'needs_review',
    decision: 'needs_review',
    queue: 'backlog',
    approvalRequired: false,
    reason: 'Low-risk surface assessment routed to backlog review.',
  };
}

function ownerFor(surfaceKind) {
  return {
    github_posture: 'platform-security',
    mcp_surface: 'ai-security',
    mcp_discovery: 'ai-security',
    ai_runtime: 'ai-platform',
    k8s_manifest: 'platform-infrastructure',
  }[surfaceKind] || 'security-operator';
}

function assessmentRefs(index) {
  return index.artifacts.filter((artifact) => artifact.artifactType === 'assessment' || artifact.artifactType === 'risk_records').map((artifact) => artifact.path);
}

function main() {
  const args = parseArgs(process.argv);
  const sourceIndexPath = abs(args.input);
  const index = readJson(sourceIndexPath);
  validate(RUN_INDEX_SCHEMA, index, 'surface run index');

  const outDir = abs(args.outDir || path.join(path.dirname(sourceIndexPath), 'operator'));
  fs.mkdirSync(outDir, { recursive: true });

  const base = slug(index.runId.replace(/^scope-d-surface-/, ''));
  const now = new Date().toISOString();
  const triage = triageFor(index);
  const workflowRunId = `operator-workflow:${base}`;
  const triageId = `operator-triage:${base}`;
  const workorderId = `operator-workorder:${base}`;

  const workflow = {
    schemaVersion: '0.1.0',
    workflowRunId,
    sourceRunIndexRef: rel(sourceIndexPath),
    surfaceKind: index.surfaceKind,
    riskScore: index.riskScore,
    riskLevel: index.riskLevel,
    findingCount: index.findingCount,
    status: triage.status,
    queue: triage.queue,
    artifacts: [
      ...index.artifacts,
      { id: 'operator-workflow', path: rel(path.join(outDir, 'operator-workflow-run.json')), artifactType: 'workflow' },
      { id: 'operator-triage', path: rel(path.join(outDir, 'operator-triage-decision.json')), artifactType: 'triage' },
      { id: 'operator-workorder', path: rel(path.join(outDir, 'operator-workorder.json')), artifactType: 'workorder' },
    ],
    createdAt: now,
    liveConnectionUsed: index.liveConnectionUsed,
    executionPerformed: false,
  };

  const triageDecision = {
    schemaVersion: '0.1.0',
    triageId,
    workflowRunId,
    sourceRunIndexRef: rel(sourceIndexPath),
    decision: triage.decision,
    queue: triage.queue,
    reason: triage.reason,
    approvalRequired: triage.approvalRequired,
    createdAt: now,
    executionAllowed: false,
    executionPerformed: false,
  };

  const workorder = {
    schemaVersion: '0.1.0',
    workorderId,
    workflowRunId,
    triageId,
    surfaceKind: index.surfaceKind,
    severity: index.riskLevel,
    status: triage.status,
    findingCount: index.findingCount,
    recommendedOwner: ownerFor(index.surfaceKind),
    approvalRequired: triage.approvalRequired,
    blockedActions: ['live_execution', 'tool_invocation', 'cluster_mutation', 'deployment', 'credential_access', 'external_scan'],
    sourceRunIndexRef: rel(sourceIndexPath),
    assessmentRefs: assessmentRefs(index),
    createdAt: now,
    executionAllowed: false,
    executionPerformed: false,
  };

  validate(WORKFLOW_SCHEMA, workflow, 'operator workflow run');
  validate(TRIAGE_SCHEMA, triageDecision, 'operator triage decision');
  validate(WORKORDER_SCHEMA, workorder, 'operator workorder');

  writeJson(path.join(outDir, 'operator-workflow-run.json'), workflow);
  writeJson(path.join(outDir, 'operator-triage-decision.json'), triageDecision);
  writeJson(path.join(outDir, 'operator-workorder.json'), workorder);

  process.stdout.write(`${JSON.stringify({ workflow, triage: triageDecision, workorder }, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  console.error(`operator-intake failed: ${err.message}`);
  process.exit(1);
}
