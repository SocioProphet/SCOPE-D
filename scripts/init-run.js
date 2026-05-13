#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const EXAMPLE_DIR = 'examples/scope-d';
const SCHEMA_DIR = 'config/schemas';

const CONTRACTS = {
  targetManifest: ['target-manifest.schema.json', 'target-manifest.json'],
  syntheticEvent: ['synthetic-event.schema.json', 'events.jsonl'],
  eventIr: ['event-ir.schema.json', 'event-ir.jsonl'],
  identityIr: ['identity-ir.schema.json', 'identity-ir.json'],
  proofArtifact: ['proof-artifact.schema.json', 'proof-artifact.json'],
  controlLoop: ['scope-d-control-loop.schema.json', 'control-loop.json'],
  safetyBoundary: ['safety-boundary.schema.json', 'safety-boundary.json'],
  receipt: ['run-receipt.schema.json', 'receipt.json'],
};

function usage() {
  console.log(`Usage: npm run scope-d:init -- [--target <identifier>] [--surface <surfaceType>] [--environment <env>] [--run-id <id>]\n\nDefaults:\n  --target local-scope-d-lab\n  --surface synthetic_lab\n  --environment lab\n\nThis command only creates local synthetic/read-only artifacts under runs/<run-id>/.\nGenerated runs include SyntheticEvent, Event-IR, Identity-IR, ProofArtifact, ControlLoopRun, RunReceipt, and report artifacts.`);
}

function parseArgs(argv) {
  const args = {
    target: 'local-scope-d-lab',
    surface: 'synthetic_lab',
    environment: 'lab',
    runId: null,
  };

  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === '--help' || key === '-h') {
      usage();
      process.exit(0);
    }
    if (key === '--target' && val) { args.target = val; i++; continue; }
    if (key === '--surface' && val) { args.surface = val; i++; continue; }
    if (key === '--environment' && val) { args.environment = val; i++; continue; }
    if (key === '--run-id' && val) { args.runId = val; i++; continue; }
    throw new Error(`Unknown or missing argument: ${key}`);
  }
  return args;
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
}

function writeJson(absPath, value) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function appendJsonl(absPath, value) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.appendFileSync(absPath, `${JSON.stringify(value)}\n`, 'utf8');
}

function sha256File(absPath) {
  return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
}

function sha256Value(value) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function timestampSlug() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').toLowerCase();
}

function localSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/^scope-d-/, '')
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '') || 'synthetic';
}

function claimSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/^scope-d-/, '')
    .replace(/[^a-z0-9_.:-]+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '') || 'synthetic';
}

function ensureSafeInputs(args) {
  const errors = [];
  if (args.environment === 'production' || args.environment === 'customer') {
    errors.push('scope-d:init refuses production/customer environments; use lab/dev/staging/unknown only');
  }
  if (args.surface !== 'synthetic_lab') {
    errors.push('scope-d:init currently supports only --surface synthetic_lab');
  }
  if (args.target.length < 1) errors.push('--target must not be empty');
  if (args.runId && !/^scope-d-[a-z0-9][a-z0-9._:-]*$/.test(args.runId)) {
    errors.push('--run-id must match ^scope-d-[a-z0-9][a-z0-9._:-]*$');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

function ensureSafeAtomic(atomic) {
  const errors = [];
  const safety = atomic.safety || {};
  const executor = atomic.executor || {};
  if (safety.blockedInProduction !== true) errors.push('atomic blockedInProduction must be true');
  if (!Array.isArray(safety.allowedModes) || safety.allowedModes.includes('live_execution')) errors.push('atomic must not allow live_execution');
  if (executor.type !== 'synthetic_event') errors.push('atomic executor.type must be synthetic_event');
  if (executor.command !== null) errors.push('atomic executor.command must be null');
  if (errors.length > 0) throw new Error(`Unsafe atomic testcase:\n${errors.join('\n')}`);
}

function createAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function validateContract(schemaRel, value, label) {
  const ajv = createAjv();
  const schema = readJson(path.join(SCHEMA_DIR, schemaRel));
  const validate = ajv.compile(schema);
  if (!validate(value)) {
    const details = (validate.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
    throw new Error(`${label} failed schema validation: ${details}`);
  }
}

function createSyntheticEvent(atomic, now) {
  const telemetry = Array.isArray(atomic.expectedTelemetry) ? atomic.expectedTelemetry : [];
  const base = telemetry[0] || { source: 'scope-d.synthetic', eventName: 'SyntheticEvent', fields: {} };
  return {
    schemaVersion: '0.1.0',
    eventType: 'scope_d.synthetic_atomic_observation',
    generatedAt: now,
    atomicTestId: atomic.id,
    atomicTestName: atomic.name,
    source: base.source || 'scope-d.synthetic',
    eventName: base.eventName || 'SyntheticEvent',
    fields: base.fields || {},
    safety: {
      mode: 'synthetic_event',
      blockedInProduction: true,
      liveExecution: false,
    },
    expectedDetections: atomic.expectedDetections || [],
  };
}

function createEventIr(runId, args, atomic, event, now) {
  const slug = localSlug(runId);
  return {
    schemaVersion: '0.1.0',
    eventId: `evt-${slug}-synthetic-observation`,
    kind: 'SYNTHETIC_ATOMIC_OBSERVATION',
    surface: 'synthetic_lab',
    scope: {
      name: args.target,
      environment: args.environment,
      tenantScope: 'lab',
      well: 'synthetic-lab',
    },
    observedAt: now,
    actor: {
      actorType: 'synthetic',
      id: 'synthetic-agent:scope-d-init',
      display: 'SCOPE-D synthetic run initializer',
    },
    resource: {
      resourceType: 'synthetic_atomic_event',
      resourceId: atomic.id,
      redactionState: 'synthetic',
    },
    facets: {
      dp: {
        epsilon: 0,
        delta: 0,
        mechanism: 'not_applicable_synthetic_observation',
        population: 'synthetic_lab',
      },
    },
    safetyClass: 'synthetic_only',
    payload: event,
    provenance: {
      collector: 'scope-d:init',
      traceId: `trace-${slug}`,
      sourceRef: 'events.jsonl',
      hash: sha256Value(event),
    },
  };
}

function createIdentityIr(runId, args, eventIr, now) {
  const slug = localSlug(runId);
  return {
    schemaVersion: '0.1.0',
    identityIrId: `identity-ir-${slug}`,
    subject: {
      subjectId: `synthetic-session:${slug}`,
      entityType: 'synthetic',
      tenantScope: 'lab',
      redactionState: 'synthetic',
    },
    eventRefs: [eventIr.eventId],
    primes: [
      {
        primeId: `prime-synthetic-${slug}`,
        primeType: 'synthetic',
        label: 'Synthetic lab evidence lane',
        wells: ['synthetic-lab'],
        evidenceRefs: [eventIr.eventId],
        coherence: 1,
        featureVector: [1, 0, 0],
        archetypeFamily: 'synthetic_observation_v1',
        configVolumeClass: 'unknown',
        configVolumeEstimate: 0,
      },
    ],
    wells: ['synthetic-lab'],
    dpBudgetState: {
      epsilonMax: 0,
      epsilonUsed: 0,
      deltaMax: 0,
      deltaUsed: 0,
      queries: 0,
    },
    proofRefs: [`proof-${slug}-synthetic-observation`],
    observedAt: now,
    safetyMode: 'synthetic_only',
    provenance: {
      collector: 'scope-d:init',
      traceId: eventIr.provenance.traceId,
      sourceRef: 'event-ir.jsonl',
      hash: sha256Value(eventIr),
    },
  };
}

function createProofArtifact(runId, args, eventIr, identityIr, now) {
  const slug = localSlug(runId);
  return {
    schemaVersion: '0.1.0',
    proofId: `proof-${slug}-synthetic-observation`,
    claim: {
      claimId: `claim.synthetic.${claimSlug(runId)}`,
      claimType: 'synthetic_observation',
      statement: 'Generated run contains only synthetic evidence and no live execution, credential collection, public scanning, or network egress.',
      epistemicLevel: 'synthetic',
    },
    status: 'SYNTHETIC_ONLY',
    safetyMode: 'synthetic_only',
    targetRefs: [args.target],
    evidenceRefs: [eventIr.eventId, identityIr.identityIrId],
    identityRefs: [identityIr.identityIrId],
    eventRefs: [eventIr.eventId],
    domains: ['synthetic'],
    invariants: [
      { name: 'live_execution_absent', result: 'pass', details: { liveExecution: false } },
      { name: 'credential_collection_absent', result: 'pass', details: { secretCollectionAllowed: false } },
      { name: 'public_scanning_absent', result: 'pass', details: { publicScanningAllowed: false } },
      { name: 'network_egress_absent', result: 'pass', details: { egressMode: 'none' } },
    ],
    dynamicMetric: {
      metricType: 'not_applicable',
      observedToSecure: 0,
      observedToNearestKnownBad: 0,
      unit: 'synthetic-only-run',
      confidence: 1,
    },
    configurationVolume: {
      volumeClass: 'unknown',
      estimate: 0,
      estimationMethod: 'not_computed',
      polytopeRef: 'not_applicable',
      notes: 'Synthetic-only initialization run; no runtime configuration-volume analyzer executed.',
    },
    archetype: {
      family: 'synthetic_observation_v1',
      coefficientHash: 'sha256:not-computed-for-synthetic-init',
      qualitativeTag: 'matches_known_benign_pattern',
    },
    witness: {
      eventIr: eventIr.eventId,
      identityIr: identityIr.identityIrId,
      mode: 'synthetic_only',
    },
    createdAt: now,
    provenance: {
      producer: 'scope-d:init',
      toolVersion: '0.1.0',
      sourceRef: 'identity-ir.json',
      hash: sha256Value(identityIr),
    },
  };
}

function main() {
  const args = parseArgs(process.argv);
  ensureSafeInputs(args);

  const now = new Date().toISOString();
  const runId = args.runId || `scope-d-${timestampSlug()}-synthetic-lab`;
  const runRel = path.join('runs', runId);
  const runAbs = path.join(ROOT, runRel);

  if (fs.existsSync(runAbs)) {
    throw new Error(`Run directory already exists: ${runRel}`);
  }

  const atomic = readJson(path.join(EXAMPLE_DIR, 'atomic-testcase.example.json'));
  ensureSafeAtomic(atomic);

  const safetyBoundary = readJson(path.join(EXAMPLE_DIR, 'safety-boundary.example.json'));
  safetyBoundary.surface.identifier = args.target;
  safetyBoundary.surface.environment = args.environment;
  safetyBoundary.auditSink.path = path.join(runRel, 'events.jsonl');

  const targetManifest = {
    schemaVersion: '0.1.0',
    target: {
      surfaceType: args.surface,
      identifier: args.target,
      environment: args.environment,
    },
    createdAt: now,
    safetyBoundaryRef: 'safety-boundary.json',
    notes: 'Generated by scope-d:init. Synthetic/read-only local run only.',
  };

  const event = createSyntheticEvent(atomic, now);
  const eventIr = createEventIr(runId, args, atomic, event, now);
  const identityIr = createIdentityIr(runId, args, eventIr, now);
  const proofArtifact = createProofArtifact(runId, args, eventIr, identityIr, now);

  const controlLoop = {
    schemaVersion: '0.1.0',
    runId,
    loopType: 'detection_regression',
    targetSurface: {
      surfaceType: args.surface,
      identifier: args.target,
      tenantScope: 'lab',
      environment: args.environment,
    },
    status: 'completed',
    safetyMode: 'synthetic_only',
    riskScore: 'unknown',
    startedAt: now,
    completedAt: now,
    gates: [
      {
        id: 'gate-synthetic-safety-boundary',
        gateType: 'scope_approval',
        decision: 'auto_continue',
        requiredActor: 'system',
        actualActor: 'scope-d:init',
        reason: 'Synthetic lab run with no credentials, no egress, and no live execution.',
        timestamp: now,
      },
    ],
    evidence: [
      {
        id: 'ev-synthetic-atomic-observation',
        collector: 'scope-d:init',
        surface: args.surface,
        resourceType: 'synthetic_atomic_event',
        resourceId: atomic.id,
        observedAt: now,
        claimLevel: 'guaranteed',
        redactionState: 'synthetic',
        tenantScope: 'lab',
        evidence: event,
        rawRef: 'events.jsonl',
      },
      {
        id: 'ev-event-ir-synthetic-observation',
        collector: 'scope-d:init',
        surface: args.surface,
        resourceType: 'event_ir_record',
        resourceId: eventIr.eventId,
        observedAt: now,
        claimLevel: 'guaranteed',
        redactionState: 'synthetic',
        tenantScope: 'lab',
        evidence: eventIr,
        rawRef: 'event-ir.jsonl',
      },
      {
        id: 'ev-identity-ir-synthetic-observation',
        collector: 'scope-d:init',
        surface: args.surface,
        resourceType: 'identity_ir_record',
        resourceId: identityIr.identityIrId,
        observedAt: now,
        claimLevel: 'guaranteed',
        redactionState: 'synthetic',
        tenantScope: 'lab',
        evidence: identityIr,
        rawRef: 'identity-ir.json',
      },
      {
        id: 'ev-proof-artifact-synthetic-observation',
        collector: 'scope-d:init',
        surface: args.surface,
        resourceType: 'proof_artifact',
        resourceId: proofArtifact.proofId,
        observedAt: now,
        claimLevel: 'guaranteed',
        redactionState: 'synthetic',
        tenantScope: 'lab',
        evidence: proofArtifact,
        rawRef: 'proof-artifact.json',
      },
    ],
    artifacts: [
      { id: 'artifact-events', artifactType: 'jsonl', path: 'events.jsonl' },
      { id: 'artifact-event-ir', artifactType: 'jsonl', path: 'event-ir.jsonl' },
      { id: 'artifact-identity-ir', artifactType: 'json', path: 'identity-ir.json' },
      { id: 'artifact-proof-artifact', artifactType: 'json', path: 'proof-artifact.json' },
      { id: 'artifact-report', artifactType: 'report', path: 'report.md' },
    ],
    controls: [],
    attackGraph: { nodes: [], edges: [], paths: [] },
  };

  validateContract(CONTRACTS.targetManifest[0], targetManifest, 'target-manifest.json');
  validateContract(CONTRACTS.syntheticEvent[0], event, 'events.jsonl synthetic event');
  validateContract(CONTRACTS.eventIr[0], eventIr, 'event-ir.jsonl Event-IR record');
  validateContract(CONTRACTS.identityIr[0], identityIr, 'identity-ir.json');
  validateContract(CONTRACTS.proofArtifact[0], proofArtifact, 'proof-artifact.json');
  validateContract(CONTRACTS.safetyBoundary[0], safetyBoundary, 'safety-boundary.json');
  validateContract(CONTRACTS.controlLoop[0], controlLoop, 'control-loop.json');

  fs.mkdirSync(runAbs, { recursive: true });
  writeJson(path.join(runAbs, 'target-manifest.json'), targetManifest);
  writeJson(path.join(runAbs, 'safety-boundary.json'), safetyBoundary);
  appendJsonl(path.join(runAbs, 'events.jsonl'), event);
  appendJsonl(path.join(runAbs, 'event-ir.jsonl'), eventIr);
  writeJson(path.join(runAbs, 'identity-ir.json'), identityIr);
  writeJson(path.join(runAbs, 'proof-artifact.json'), proofArtifact);
  writeJson(path.join(runAbs, 'control-loop.json'), controlLoop);

  const report = [
    '# SCOPE-D Synthetic Run Report',
    '',
    `Run ID: ${runId}`,
    `Target: ${args.target}`,
    `Surface: ${args.surface}`,
    `Environment: ${args.environment}`,
    '',
    '## Safety',
    '',
    '- Mode: synthetic_only',
    '- Live execution: false',
    '- Credentials: none',
    '- Network egress: none',
    '- Public scanning: false',
    '',
    '## Synthetic Observation',
    '',
    `- Atomic test: ${atomic.id}`,
    `- Event name: ${event.eventName}`,
    `- Expected detections: ${event.expectedDetections.length}`,
    '',
    '## Contract Artifacts',
    '',
    `- Event-IR: ${eventIr.eventId}`,
    `- Identity-IR: ${identityIr.identityIrId}`,
    `- ProofArtifact: ${proofArtifact.proofId}`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(runAbs, 'report.md'), report, 'utf8');

  const artifactFiles = [
    'target-manifest.json',
    'safety-boundary.json',
    'events.jsonl',
    'event-ir.jsonl',
    'identity-ir.json',
    'proof-artifact.json',
    'control-loop.json',
    'report.md',
  ];
  const receipt = {
    schemaVersion: '0.1.0',
    id: `receipt-${runId.replace(/^scope-d-/, '')}`,
    runId,
    status: 'completed',
    artifactHashes: artifactFiles.map((file) => ({
      path: path.join(runRel, file),
      sha256: sha256File(path.join(runAbs, file)),
    })),
    policyDecisions: ['gate-synthetic-safety-boundary'],
    safetySummary: {
      mode: 'synthetic_only',
      liveActionsExecuted: 0,
      destructiveActionsBlocked: 0,
      notes: 'Synthetic lab run generated locally; no live actions were available or executed.',
    },
    issuedAt: now,
    signature: {
      algorithm: 'none',
      keyId: 'local-synthetic-run',
      value: 'unsigned-local-receipt',
    },
  };

  validateContract(CONTRACTS.receipt[0], receipt, 'receipt.json');
  writeJson(path.join(runAbs, 'receipt.json'), receipt);

  console.log(`Created SCOPE-D synthetic run: ${runRel}`);
  console.log('Artifacts: target-manifest.json, safety-boundary.json, events.jsonl, event-ir.jsonl, identity-ir.json, proof-artifact.json, control-loop.json, report.md, receipt.json');
}

try {
  main();
} catch (err) {
  console.error(`scope-d:init failed: ${err.message}`);
  process.exit(1);
}
