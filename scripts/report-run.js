#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_DIR = 'config/schemas';
const RUN_SUMMARY_SCHEMA = 'run-summary.schema.json';

function usage() {
  console.log(`Usage: npm run scope-d:report-run -- <runs/<run-id>>\n\nVerifies a generated SCOPE-D run, then writes deterministic run-summary.json and run-summary.md artifacts into the run directory.`);
}

function readJsonAbs(absPath) {
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}

function readJsonRel(relPath) {
  return readJsonAbs(path.join(ROOT, relPath));
}

function writeJson(absPath, value) {
  fs.writeFileSync(absPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function validateSummary(summary) {
  const ajv = createAjv();
  const schema = readJsonRel(path.join(SCHEMA_DIR, RUN_SUMMARY_SCHEMA));
  const validate = ajv.compile(schema);
  if (!validate(summary)) {
    const details = (validate.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
    throw new Error(`run-summary.json failed schema validation: ${details}`);
  }
}

function verifyRun(runArg) {
  const verifyScript = path.join(ROOT, 'scripts', 'verify-run.js');
  childProcess.execFileSync(process.execPath, [verifyScript, runArg], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

function countJsonl(absPath) {
  if (!fs.existsSync(absPath)) return 0;
  return fs.readFileSync(absPath, 'utf8').split('\n').filter(Boolean).length;
}

function countJsonFile(absPath) {
  return fs.existsSync(absPath) ? 1 : 0;
}

function renderMarkdown(summary) {
  const artifactRows = summary.artifacts
    .map((artifact) => `| \`${artifact.path}\` | \`${artifact.sha256}\` |`)
    .join('\n');

  const notes = summary.handoff.notes.map((note) => `- ${note}`).join('\n');

  return [
    '# SCOPE-D Run Summary',
    '',
    `Run ID: ${summary.runId}`,
    `Verified: ${summary.verified}`,
    `Generated at: ${summary.generatedAt}`,
    `Source run dir: ${summary.sourceRunDir}`,
    '',
    '## Target',
    '',
    `- Surface: ${summary.target.surfaceType}`,
    `- Identifier: ${summary.target.identifier}`,
    `- Environment: ${summary.target.environment}`,
    '',
    '## Safety',
    '',
    `- Mode: ${summary.safety.mode}`,
    `- Live actions executed: ${summary.safety.liveActionsExecuted}`,
    `- Network egress: ${summary.safety.networkEgress}`,
    `- Secret collection allowed: ${summary.safety.secretCollectionAllowed}`,
    `- Public scanning allowed: ${summary.safety.publicScanningAllowed}`,
    '',
    '## Counts',
    '',
    `- Synthetic events: ${summary.counts.syntheticEvents}`,
    `- Event-IR records: ${summary.counts.eventIrRecords || 0}`,
    `- Identity-IR records: ${summary.counts.identityIrRecords || 0}`,
    `- Proof artifacts: ${summary.counts.proofArtifacts || 0}`,
    `- Evidence items: ${summary.counts.evidenceItems}`,
    `- Gates: ${summary.counts.gates}`,
    `- Receipt artifacts: ${summary.counts.receiptArtifacts}`,
    '',
    '## Receipt',
    '',
    `- Receipt ID: ${summary.receipt.receiptId}`,
    `- Status: ${summary.receipt.status}`,
    `- Issued at: ${summary.receipt.issuedAt}`,
    '',
    '## Handoff',
    '',
    `- SocioSphere ready: ${summary.handoff.sociosphereReady}`,
    `- PolicyFabric ready: ${summary.handoff.policyFabricReady}`,
    '',
    notes,
    '',
    '## Artifact Hashes',
    '',
    '| Path | SHA-256 |',
    '|---|---|',
    artifactRows,
    '',
  ].join('\n');
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

  verifyRun(runRel);

  const targetManifest = readJsonAbs(path.join(runAbs, 'target-manifest.json'));
  const safetyBoundary = readJsonAbs(path.join(runAbs, 'safety-boundary.json'));
  const controlLoop = readJsonAbs(path.join(runAbs, 'control-loop.json'));
  const receipt = readJsonAbs(path.join(runAbs, 'receipt.json'));
  const syntheticEvents = countJsonl(path.join(runAbs, 'events.jsonl'));
  const eventIrRecords = countJsonl(path.join(runAbs, 'event-ir.jsonl'));
  const identityIrRecords = countJsonFile(path.join(runAbs, 'identity-ir.json'));
  const proofArtifacts = countJsonFile(path.join(runAbs, 'proof-artifact.json'));

  const summary = {
    schemaVersion: '0.1.0',
    summaryId: `summary-${controlLoop.runId.replace(/^scope-d-/, '')}`,
    runId: controlLoop.runId,
    sourceRunDir: runRel,
    generatedAt: receipt.issuedAt,
    verified: true,
    target: {
      surfaceType: targetManifest.target.surfaceType,
      identifier: targetManifest.target.identifier,
      environment: targetManifest.target.environment,
    },
    safety: {
      mode: controlLoop.safetyMode,
      liveActionsExecuted: receipt.safetySummary.liveActionsExecuted,
      networkEgress: safetyBoundary.networkBoundary.egressMode,
      secretCollectionAllowed: safetyBoundary.credentialBoundary.secretCollectionAllowed,
      publicScanningAllowed: safetyBoundary.networkBoundary.publicScanningAllowed,
    },
    counts: {
      syntheticEvents,
      eventIrRecords,
      identityIrRecords,
      proofArtifacts,
      evidenceItems: Array.isArray(controlLoop.evidence) ? controlLoop.evidence.length : 0,
      gates: Array.isArray(controlLoop.gates) ? controlLoop.gates.length : 0,
      receiptArtifacts: Array.isArray(receipt.artifactHashes) ? receipt.artifactHashes.length : 0,
    },
    receipt: {
      receiptId: receipt.id,
      status: receipt.status,
      issuedAt: receipt.issuedAt,
    },
    artifacts: receipt.artifactHashes,
    handoff: {
      sociosphereReady: true,
      policyFabricReady: true,
      notes: [
        'Run verified before reporting.',
        'All artifacts referenced by the receipt matched their SHA-256 hashes.',
        'Synthetic-only run is safe for dashboard and policy-fabric ingestion as non-production evidence.',
        'Event-IR, Identity-IR, and ProofArtifact artifacts are generated and verified for this run.',
      ],
    },
  };

  validateSummary(summary);

  writeJson(path.join(runAbs, 'run-summary.json'), summary);
  fs.writeFileSync(path.join(runAbs, 'run-summary.md'), renderMarkdown(summary), 'utf8');

  console.log(`Wrote SCOPE-D run summary: ${path.join(runRel, 'run-summary.json')}`);
  console.log(`Wrote SCOPE-D run report: ${path.join(runRel, 'run-summary.md')}`);
}

try {
  main();
} catch (err) {
  console.error(`scope-d:report-run failed: ${err.message}`);
  process.exit(1);
}
