#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_SCHEMA = 'config/schemas/operator-run-manifest.schema.json';

function usage() {
  console.log('Usage: node scripts/generate-run-manifest.js <operator-scan-assurance-run.json> [--out <manifest.json>]');
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
  if (!args.input) throw new Error('Missing source run path.');
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
  const out = abs(file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'artifact';
}

function inferType(refName, artifactPath) {
  if (refName === 'sourceRunRef') return 'source_run';
  if (artifactPath.endsWith('operator-scan-policy.json')) return 'scan_policy';
  if (artifactPath.endsWith('operator-scan-request.json')) return 'scan_request';
  if (artifactPath.endsWith('operator-scan-plan.json')) return 'scan_plan';
  if (artifactPath.endsWith('operator-scan-result.json')) return 'scan_result';
  if (artifactPath.endsWith('operator-scan-result-assessment.json')) return 'scan_assessment';
  if (artifactPath.endsWith('surface-run-index.json')) return 'surface_run_index';
  if (artifactPath.endsWith('operator-workflow-run.json')) return 'operator_workflow';
  if (artifactPath.endsWith('operator-workorders.json')) return 'operator_workorders';
  if (artifactPath.endsWith('case-index.json')) return 'case_index';
  if (artifactPath.endsWith('operator-dashboard.json')) return 'operator_dashboard';
  if (artifactPath.endsWith('client-assurance-report.json')) return 'client_report';
  if (artifactPath.endsWith('operator-live-readonly-scan-receipt.json')) return 'live_readonly_receipt';
  return slug(path.basename(artifactPath, path.extname(artifactPath)));
}

function hashArtifact(baseDir, refName, refValue) {
  if (refValue === null || refValue === undefined || refValue === '') return null;
  const candidate = path.isAbsolute(refValue) ? refValue : path.join(ROOT, refValue);
  const fallback = path.join(baseDir, refValue);
  const file = fs.existsSync(candidate) ? candidate : fallback;
  if (!fs.existsSync(file)) throw new Error(`Missing artifact for ${refName}: ${refValue}`);
  const bytes = fs.readFileSync(file);
  return {
    artifactId: slug(refName.replace(/Ref$/, '')),
    path: rel(file),
    artifactType: inferType(refName, file),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    byteLength: bytes.length,
  };
}

function artifactRefs(sourceRunPath, run) {
  const refs = [
    ['sourceRunRef', sourceRunPath],
    ['policyRef', run.policyRef],
    ['requestRef', run.requestRef],
    ['planRef', run.planRef],
    ['liveReadOnlyReceiptRef', run.liveReadOnlyReceiptRef],
    ['scanResultRef', run.scanResultRef],
    ['scanAssessmentRef', run.scanAssessmentRef],
    ['surfaceRunIndexRef', run.surfaceRunIndexRef],
    ['operatorWorkflowRef', run.operatorWorkflowRef],
    ['operatorWorkordersRef', run.operatorWorkordersRef],
    ['caseIndexRef', run.caseIndexRef],
    ['dashboardRef', run.dashboardRef],
    ['clientReportRef', run.clientReportRef],
  ];
  return refs;
}

function main() {
  const args = parseArgs(process.argv);
  const sourceRunPath = abs(args.input);
  const run = readJson(sourceRunPath);
  const baseDir = path.dirname(sourceRunPath);
  const artifacts = [];
  const ids = new Set();

  for (const [refName, refValue] of artifactRefs(sourceRunPath, run)) {
    const artifact = hashArtifact(baseDir, refName, refValue);
    if (!artifact) continue;
    if (ids.has(artifact.artifactId)) throw new Error(`Duplicate artifact id: ${artifact.artifactId}`);
    ids.add(artifact.artifactId);
    artifacts.push(artifact);
  }

  const manifest = {
    schemaVersion: '0.1.0',
    manifestId: `operator-run-manifest:${slug(run.runId || path.basename(sourceRunPath, '.json'))}`,
    sourceRunRef: rel(sourceRunPath),
    sourceRunId: run.runId,
    clientRef: run.clientRef || 'client:unknown',
    mode: run.mode || 'unknown',
    generatedAt: new Date().toISOString(),
    artifactCount: artifacts.length,
    artifacts,
    boundaryFlags: {
      networkAccessAttempted: run.networkAccessAttempted === true,
      scanExecutionPerformed: run.scanExecutionPerformed === true,
      executionAllowed: run.executionAllowed === true,
      executionPerformed: run.executionPerformed === true,
    },
    nonClaims: [
      'This manifest records artifact digests only; it does not certify full security.',
      'This manifest does not authorize live action, credential access, payload delivery, mutation, or destructive behavior.',
      'This manifest is evidence metadata for a completed SCOPE-D run.'
    ],
  };

  validate(MANIFEST_SCHEMA, manifest, 'operator run manifest');
  if (args.out) writeJson(args.out, manifest);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  console.error(`generate-run-manifest failed: ${err.message}`);
  process.exit(1);
}
