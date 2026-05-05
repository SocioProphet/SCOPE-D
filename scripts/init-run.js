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
  controlLoop: ['scope-d-control-loop.schema.json', 'control-loop.json'],
  safetyBoundary: ['safety-boundary.schema.json', 'safety-boundary.json'],
  receipt: ['run-receipt.schema.json', 'receipt.json'],
};

function usage() {
  console.log(`Usage: npm run scope-d:init -- [--target <identifier>] [--surface <surfaceType>] [--environment <env>] [--run-id <id>]\n\nDefaults:\n  --target local-scope-d-lab\n  --surface synthetic_lab\n  --environment lab\n\nThis command only creates local synthetic/read-only artifacts under runs/<run-id>/.`);
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

function timestampSlug() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').toLowerCase();
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

function validateContract(schemaRel, value, label) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
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
    ],
    artifacts: [],
    controls: [],
    attackGraph: { nodes: [], edges: [], paths: [] },
  };

  validateContract(CONTRACTS.safetyBoundary[0], safetyBoundary, 'safety-boundary.json');
  validateContract(CONTRACTS.controlLoop[0], controlLoop, 'control-loop.json');

  fs.mkdirSync(runAbs, { recursive: true });
  writeJson(path.join(runAbs, 'target-manifest.json'), targetManifest);
  writeJson(path.join(runAbs, 'safety-boundary.json'), safetyBoundary);
  appendJsonl(path.join(runAbs, 'events.jsonl'), event);
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
  ].join('\n');
  fs.writeFileSync(path.join(runAbs, 'report.md'), report, 'utf8');

  const artifactFiles = ['target-manifest.json', 'safety-boundary.json', 'events.jsonl', 'control-loop.json', 'report.md'];
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
  console.log('Artifacts: target-manifest.json, safety-boundary.json, events.jsonl, control-loop.json, report.md, receipt.json');
}

try {
  main();
} catch (err) {
  console.error(`scope-d:init failed: ${err.message}`);
  process.exit(1);
}
