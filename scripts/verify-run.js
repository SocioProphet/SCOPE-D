#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_DIR = 'config/schemas';

const FILE_SCHEMAS = {
  'engagement-policy.json': 'engagement-policy.schema.json',
  'target-manifest.json': 'target-manifest.schema.json',
  'safety-boundary.json': 'safety-boundary.schema.json',
  'identity-ir.json': 'identity-ir.schema.json',
  'proof-artifact.json': 'proof-artifact.schema.json',
  'control-loop.json': 'scope-d-control-loop.schema.json',
  'receipt.json': 'run-receipt.schema.json',
};

const EVENT_SCHEMA = 'synthetic-event.schema.json';
const EVENT_IR_SCHEMA = 'event-ir.schema.json';

function usage() {
  console.log(`Usage: npm run scope-d:verify-run -- <runs/<run-id>>\n\nVerifies a generated SCOPE-D run directory by checking required artifacts, engagement policy, AJV schemas, JSONL events, Event-IR, Identity-IR, ProofArtifact, and receipt artifact hashes.`);
}

function readJsonAbs(absPath) {
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}

function readJsonRel(relPath) {
  return readJsonAbs(path.join(ROOT, relPath));
}

function sha256File(absPath) {
  return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
}

function createAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function compileSchema(schemaRel) {
  const ajv = createAjv();
  const schema = readJsonRel(path.join(SCHEMA_DIR, schemaRel));
  return ajv.compile(schema);
}

function formatAjvErrors(validate) {
  return (validate.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

function validateJsonFile(runAbs, fileName, schemaRel, errors, options = {}) {
  const fileAbs = path.join(runAbs, fileName);
  if (options.optional && !fs.existsSync(fileAbs)) return null;
  assert(fs.existsSync(fileAbs), `Missing required artifact: ${fileName}`, errors);
  if (!fs.existsSync(fileAbs)) return null;

  let value;
  try {
    value = readJsonAbs(fileAbs);
  } catch (err) {
    errors.push(`Invalid JSON in ${fileName}: ${err.message}`);
    return null;
  }

  const validate = compileSchema(schemaRel);
  if (!validate(value)) {
    errors.push(`${fileName} failed ${schemaRel}: ${formatAjvErrors(validate)}`);
  }
  return value;
}

function validateJsonlFile(runAbs, fileName, schemaRel, errors, label, options = {}) {
  const fileAbs = path.join(runAbs, fileName);
  if (options.optional && !fs.existsSync(fileAbs)) return 0;
  assert(fs.existsSync(fileAbs), `Missing required artifact: ${fileName}`, errors);
  if (!fs.existsSync(fileAbs)) return 0;

  const validate = compileSchema(schemaRel);
  const lines = fs.readFileSync(fileAbs, 'utf8').split('\n').filter(Boolean);
  assert(lines.length > 0, `${fileName} must contain at least one ${label}`, errors);

  for (let i = 0; i < lines.length; i++) {
    let event;
    try {
      event = JSON.parse(lines[i]);
    } catch (err) {
      errors.push(`${fileName} line ${i + 1}: invalid JSON: ${err.message}`);
      continue;
    }
    if (!validate(event)) {
      errors.push(`${fileName} line ${i + 1} failed ${schemaRel}: ${formatAjvErrors(validate)}`);
    }
    if (fileName === 'events.jsonl' && event && event.safety) {
      assert(event.safety.liveExecution === false, `${fileName} line ${i + 1}: liveExecution must be false`, errors);
      assert(event.safety.blockedInProduction === true, `${fileName} line ${i + 1}: blockedInProduction must be true`, errors);
    }
    if (fileName === 'event-ir.jsonl' && event) {
      assert(event.safetyClass === 'synthetic_only', `${fileName} line ${i + 1}: safetyClass must be synthetic_only`, errors);
    }
  }

  return lines.length;
}

function verifyReceiptHashes(runAbs, runRel, receipt, errors) {
  if (!receipt || !Array.isArray(receipt.artifactHashes)) return;

  const seen = new Set();
  for (const artifact of receipt.artifactHashes) {
    const relPath = artifact.path;
    assert(typeof relPath === 'string' && relPath.startsWith(`${runRel}/`), `Receipt artifact path is outside run dir: ${relPath}`, errors);
    const localFile = relPath.replace(`${runRel}/`, '');
    const fileAbs = path.join(runAbs, localFile);
    assert(fs.existsSync(fileAbs), `Receipt references missing artifact: ${relPath}`, errors);
    if (!fs.existsSync(fileAbs)) continue;
    const actual = sha256File(fileAbs);
    assert(actual === artifact.sha256, `Hash mismatch for ${relPath}: expected ${artifact.sha256}, got ${actual}`, errors);
    seen.add(localFile);
  }

  for (const required of [
    'engagement-policy.json',
    'target-manifest.json',
    'safety-boundary.json',
    'events.jsonl',
    'event-ir.jsonl',
    'identity-ir.json',
    'proof-artifact.json',
    'control-loop.json',
    'report.md',
  ]) {
    assert(seen.has(required), `Receipt missing hash for required artifact: ${required}`, errors);
  }
}

function validatePolicyAuthorizesRun(engagementPolicy, targetManifest, controlLoop, errors) {
  if (!engagementPolicy || !targetManifest || !controlLoop) return;
  const target = targetManifest.target.identifier;
  const surface = targetManifest.target.surfaceType;
  const mode = controlLoop.safetyMode;

  assert((engagementPolicy.authorizedTargets || []).includes(target), `engagement-policy.json does not authorize target ${target}`, errors);
  assert((engagementPolicy.targetBoundary && engagementPolicy.targetBoundary.authorizedTargets || []).includes(target), `engagement-policy.json targetBoundary does not authorize target ${target}`, errors);
  assert((engagementPolicy.authorizedSurfaces || []).includes(surface), `engagement-policy.json does not authorize surface ${surface}`, errors);
  assert((engagementPolicy.authorizedModes || []).includes(mode), `engagement-policy.json does not authorize mode ${mode}`, errors);
  assert(engagementPolicy.authority && engagementPolicy.authority.delegationAllowed === false, 'engagement-policy.json must not allow delegation without a signed delegation policy', errors);
  if ((engagementPolicy.authorizedModes || []).includes('live_engage')) {
    assert((engagementPolicy.michaelApprovalRequiredForModes || []).includes('live_engage'), 'engagement-policy.json authorizes live_engage without Michael approval requirement', errors);
  }
}

function validateCrossArtifactConsistency(engagementPolicy, targetManifest, safetyBoundary, identityIr, proofArtifact, controlLoop, receipt, runRel, errors) {
  if (targetManifest && controlLoop) {
    assert(targetManifest.target.identifier === controlLoop.targetSurface.identifier, 'Target identifier mismatch between target-manifest.json and control-loop.json', errors);
    assert(targetManifest.target.surfaceType === controlLoop.targetSurface.surfaceType, 'Surface type mismatch between target-manifest.json and control-loop.json', errors);
    assert(targetManifest.target.environment === controlLoop.targetSurface.environment, 'Environment mismatch between target-manifest.json and control-loop.json', errors);
  }

  if (safetyBoundary) {
    assert(safetyBoundary.defaultMode === 'synthetic_only', 'safety-boundary.json defaultMode must be synthetic_only for generated runs', errors);
    assert(safetyBoundary.networkBoundary && safetyBoundary.networkBoundary.egressMode === 'none', 'safety-boundary.json must set network egressMode=none', errors);
    assert(safetyBoundary.credentialBoundary && safetyBoundary.credentialBoundary.secretCollectionAllowed === false, 'safety-boundary.json must prohibit secret collection', errors);
  }

  if (identityIr && proofArtifact) {
    assert((proofArtifact.identityRefs || []).includes(identityIr.identityIrId), 'proof-artifact.json must reference identity-ir.json identityIrId', errors);
    for (const eventRef of identityIr.eventRefs || []) {
      assert((proofArtifact.eventRefs || []).includes(eventRef), `proof-artifact.json must reference Identity-IR event ${eventRef}`, errors);
    }
  }

  if (controlLoop) {
    assert(controlLoop.safetyMode === 'synthetic_only', 'control-loop.json safetyMode must be synthetic_only for generated runs', errors);
    assert(controlLoop.status === 'completed', 'control-loop.json status should be completed for generated runs', errors);
    const evidenceRefs = new Set((controlLoop.evidence || []).map((ev) => ev.resourceId));
    if (engagementPolicy) assert(evidenceRefs.has(engagementPolicy.policyId), 'control-loop.json evidence must reference engagement-policy.json', errors);
    if (identityIr) assert(evidenceRefs.has(identityIr.identityIrId), 'control-loop.json evidence must reference identity-ir.json', errors);
    if (proofArtifact) assert(evidenceRefs.has(proofArtifact.proofId), 'control-loop.json evidence must reference proof-artifact.json', errors);
  }

  if (receipt) {
    assert(receipt.runId && runRel.endsWith(receipt.runId), `receipt.json runId ${receipt.runId} must match run directory ${runRel}`, errors);
    assert(receipt.safetySummary && receipt.safetySummary.liveActionsExecuted === 0, 'receipt.json must record zero live actions', errors);
    assert((receipt.policyDecisions || []).includes('gate-engagement-policy'), 'receipt.json must include gate-engagement-policy decision', errors);
  }

  validatePolicyAuthorizesRun(engagementPolicy, targetManifest, controlLoop, errors);
}

function main() {
  const runArg = process.argv[2];
  if (!runArg || runArg === '--help' || runArg === '-h') {
    usage();
    process.exit(runArg ? 0 : 1);
  }

  const runAbs = path.resolve(ROOT, runArg);
  const runRel = path.relative(ROOT, runAbs).replace(/\\/g, '/');
  const errors = [];

  assert(runRel.startsWith('runs/'), `Run directory must be under runs/: ${runRel}`, errors);
  assert(fs.existsSync(runAbs) && fs.statSync(runAbs).isDirectory(), `Run directory not found: ${runRel}`, errors);

  if (errors.length === 0) {
    const engagementPolicy = validateJsonFile(runAbs, 'engagement-policy.json', FILE_SCHEMAS['engagement-policy.json'], errors);
    const targetManifest = validateJsonFile(runAbs, 'target-manifest.json', FILE_SCHEMAS['target-manifest.json'], errors);
    const safetyBoundary = validateJsonFile(runAbs, 'safety-boundary.json', FILE_SCHEMAS['safety-boundary.json'], errors);
    const controlLoop = validateJsonFile(runAbs, 'control-loop.json', FILE_SCHEMAS['control-loop.json'], errors);
    const identityIr = validateJsonFile(runAbs, 'identity-ir.json', FILE_SCHEMAS['identity-ir.json'], errors);
    const proofArtifact = validateJsonFile(runAbs, 'proof-artifact.json', FILE_SCHEMAS['proof-artifact.json'], errors);
    const receipt = validateJsonFile(runAbs, 'receipt.json', FILE_SCHEMAS['receipt.json'], errors);
    const eventCount = validateJsonlFile(runAbs, 'events.jsonl', EVENT_SCHEMA, errors, 'synthetic event');
    const eventIrCount = validateJsonlFile(runAbs, 'event-ir.jsonl', EVENT_IR_SCHEMA, errors, 'Event-IR record');

    assert(fs.existsSync(path.join(runAbs, 'report.md')), 'Missing required artifact: report.md', errors);
    verifyReceiptHashes(runAbs, runRel, receipt, errors);
    validateCrossArtifactConsistency(engagementPolicy, targetManifest, safetyBoundary, identityIr, proofArtifact, controlLoop, receipt, runRel, errors);

    if (errors.length === 0) {
      console.log(`Verified SCOPE-D run: ${runRel} (${eventCount} synthetic event${eventCount === 1 ? '' : 's'}, ${eventIrCount} Event-IR record${eventIrCount === 1 ? '' : 's'})`);
      return;
    }
  }

  console.error(`SCOPE-D run verification failed for ${runRel}:`);
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

main();
