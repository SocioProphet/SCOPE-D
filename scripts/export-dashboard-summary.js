#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA = 'config/schemas/dashboard-export.schema.json';

function usage() {
  console.log(`Usage: npm run scope-d:export-dashboard -- <runs/<run-id>>\n\nVerifies and reports a SCOPE-D run, then writes dashboard-summary.json for SocioSphere-style non-production dashboard ingestion.`);
}

function runNodeScript(scriptName, args) {
  childProcess.execFileSync(process.execPath, [path.join(ROOT, 'scripts', scriptName), ...args], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}

function writeJson(absPath, value) {
  fs.writeFileSync(absPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function validateDashboard(dashboard) {
  const ajv = createAjv();
  const schema = readJson(path.join(ROOT, SCHEMA));
  const validate = ajv.compile(schema);
  if (!validate(dashboard)) {
    const details = (validate.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
    throw new Error(`dashboard-summary.json failed schema validation: ${details}`);
  }
}

function laneStatus(status, count, notes) {
  return { status, count, notes };
}

function buildLanes(counts) {
  const eventIr = counts.eventIrRecords || 0;
  const identityIr = counts.identityIrRecords || 0;
  const proofs = counts.proofArtifacts || 0;
  const aiInfra = (counts.aiInfraAssessments || 0) + (counts.mcpToolRisks || 0) + (counts.countermeasureRules || 0);
  const graph = counts.graphRobustnessAssessments || 0;

  return {
    genericProofChain: laneStatus(
      eventIr > 0 && identityIr > 0 && proofs > 0 ? 'present' : 'absent',
      Math.min(eventIr, identityIr, proofs),
      ['Requires Event-IR, Identity-IR, and ProofArtifact to be present in a verified run.']
    ),
    aiInfra: laneStatus(
      aiInfra > 0 ? 'present' : 'absent',
      aiInfra,
      aiInfra > 0
        ? ['AI-infra synthetic domain artifacts are present.']
        : ['No AI-infra synthetic domain artifacts are present in this run.']
    ),
    graphRobustness: laneStatus(
      graph > 0 ? 'present' : 'absent',
      graph,
      graph > 0
        ? ['Graph robustness synthetic domain artifacts are present.']
        : ['No graph robustness synthetic domain artifacts are present in this run.']
    ),
  };
}

function main() {
  const runArg = process.argv[2];
  if (!runArg || runArg === '--help' || runArg === '-h') {
    usage();
    process.exit(runArg ? 0 : 1);
  }

  const runAbs = path.resolve(ROOT, runArg);
  const runRel = path.relative(ROOT, runAbs).replace(/\\/g, '/');
  if (!runRel.startsWith('runs/')) {
    throw new Error(`Run directory must be under runs/: ${runRel}`);
  }

  runNodeScript('report-run.js', [runRel]);

  const summary = readJson(path.join(runAbs, 'run-summary.json'));
  if (summary.verified !== true) throw new Error('Refusing to export dashboard for unverified run summary.');

  const counts = {
    syntheticEvents: summary.counts.syntheticEvents || 0,
    eventIrRecords: summary.counts.eventIrRecords || 0,
    identityIrRecords: summary.counts.identityIrRecords || 0,
    proofArtifacts: summary.counts.proofArtifacts || 0,
    aiInfraAssessments: summary.counts.aiInfraAssessments || 0,
    mcpToolRisks: summary.counts.mcpToolRisks || 0,
    countermeasureRules: summary.counts.countermeasureRules || 0,
    graphRobustnessAssessments: summary.counts.graphRobustnessAssessments || 0,
    evidenceItems: summary.counts.evidenceItems || 0,
    gates: summary.counts.gates || 0,
    receiptArtifacts: summary.counts.receiptArtifacts || 0,
  };

  const dashboard = {
    schemaVersion: '0.1.0',
    dashboardId: `dashboard-${summary.runId.replace(/^scope-d-/, '')}`,
    runId: summary.runId,
    sourceRunDir: summary.sourceRunDir,
    generatedAt: summary.generatedAt,
    verified: true,
    nonProductionOnly: true,
    target: summary.target,
    safety: summary.safety,
    counts,
    lanes: buildLanes(counts),
    receipt: summary.receipt,
    artifactRefs: summary.artifacts,
    handoff: {
      sociosphereReady: true,
      policyFabricReady: true,
      notes: [
        'Dashboard export was derived from a verified run summary.',
        'Dashboard export is non-production only.',
        'Artifact hashes are copied from the verified run receipt.',
      ],
    },
  };

  validateDashboard(dashboard);
  writeJson(path.join(runAbs, 'dashboard-summary.json'), dashboard);
  console.log(`Wrote SCOPE-D dashboard export: ${path.join(runRel, 'dashboard-summary.json')}`);
}

try {
  main();
} catch (err) {
  console.error(`scope-d:export-dashboard failed: ${err.message}`);
  process.exit(1);
}
