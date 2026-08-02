#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const { registerCanonicalProofArtifact } = require('./lib/canonical-schemas');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_DIR = 'config/schemas';
const EXAMPLE_DIR = 'examples/scope-d';
const DEFAULT_GRAPH = 'fixtures/synthetic/graph-robustness.identity-trust.synthetic.json';
const INIT_MODE = 'synthetic_only';

const CONTRACTS = {
  targetManifest: ['target-manifest.schema.json', 'target-manifest.json'],
  engagementPolicy: ['engagement-policy.schema.json', 'engagement-policy.json'],
  syntheticEvent: ['synthetic-event.schema.json', 'events.jsonl'],
  eventIr: ['event-ir.schema.json', 'event-ir.jsonl'],
  identityIr: ['identity-ir.schema.json', 'identity-ir.json'],
  proofArtifact: ['proof-artifact.schema.json', 'proof-artifact.json'],
  graphRobustnessAssessment: ['graph-robustness-assessment.schema.json', 'graph-robustness-assessment.json'],
  controlLoop: ['scope-d-control-loop.schema.json', 'control-loop.json'],
  safetyBoundary: ['safety-boundary.schema.json', 'safety-boundary.json'],
  receipt: ['run-receipt.schema.json', 'receipt.json'],
};

function usage() {
  console.log(`Usage: npm run scope-d:init-graph-robustness -- --engagement-policy <path> [--target <identifier>] [--graph-fixture <path>] [--run-id <id>]\n\nDefaults:\n  --target local-graph-robustness-lab\n  --graph-fixture ${DEFAULT_GRAPH}\n\nCreates a synthetic-only graph robustness run. FAIL-CLOSED: --engagement-policy is required.`);
}

function parseArgs(argv) {
  const args = {
    target: 'local-graph-robustness-lab',
    surface: 'synthetic_lab',
    environment: 'lab',
    runId: null,
    engagementPolicy: null,
    graphFixture: DEFAULT_GRAPH,
  };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === '--help' || key === '-h') { usage(); process.exit(0); }
    if (key === '--target' && val) { args.target = val; i++; continue; }
    if (key === '--graph-fixture' && val) { args.graphFixture = val; i++; continue; }
    if (key === '--environment' && val) { args.environment = val; i++; continue; }
    if (key === '--run-id' && val) { args.runId = val; i++; continue; }
    if (key === '--engagement-policy' && val) { args.engagementPolicy = val; i++; continue; }
    throw new Error(`Unknown or missing argument: ${key}`);
  }
  return args;
}

function resolveRepoPath(inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.join(ROOT, inputPath);
}
function readJsonRel(relPath) { return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8')); }
function readJsonAbs(absPath) { return JSON.parse(fs.readFileSync(absPath, 'utf8')); }
function writeJson(absPath, value) { fs.mkdirSync(path.dirname(absPath), { recursive: true }); fs.writeFileSync(absPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function appendJsonl(absPath, value) { fs.mkdirSync(path.dirname(absPath), { recursive: true }); fs.appendFileSync(absPath, `${JSON.stringify(value)}\n`, 'utf8'); }
function sha256File(absPath) { return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex'); }
function sha256Value(value) { return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`; }
function timestampSlug() { return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').toLowerCase(); }
function localSlug(value) { return String(value).toLowerCase().replace(/^scope-d-/, '').replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+/, '').replace(/-+$/, '') || 'synthetic'; }
function claimSlug(value) { return String(value).toLowerCase().replace(/^scope-d-/, '').replace(/[^a-z0-9_.:-]+/g, '_').replace(/^_+/, '').replace(/_+$/, '') || 'synthetic'; }

function createAjv() { const ajv = new Ajv({ allErrors: true, strict: false }); addFormats(ajv); registerCanonicalProofArtifact(ajv); return ajv; }
function validateContract(schemaRel, value, label) {
  const ajv = createAjv();
  const schema = readJsonRel(path.join(SCHEMA_DIR, schemaRel));
  const validate = ajv.compile(schema);
  if (!validate(value)) {
    const details = (validate.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
    throw new Error(`${label} failed schema validation: ${details}`);
  }
}

function ensureSafeInputs(args) {
  const errors = [];
  if (!args.engagementPolicy) errors.push('FAIL-CLOSED: --engagement-policy is required. No fallback to synthetic-only mode when policy path is absent.');
  if (args.environment === 'production' || args.environment === 'customer') errors.push('scope-d:init-graph-robustness refuses production/customer environments; use lab/dev/staging/unknown only');
  if (args.surface !== 'synthetic_lab') errors.push('scope-d:init-graph-robustness currently supports only synthetic_lab surface');
  if (args.target.length < 1) errors.push('--target must not be empty');
  if (args.runId && !/^scope-d-[a-z0-9][a-z0-9._:-]*$/.test(args.runId)) errors.push('--run-id must match ^scope-d-[a-z0-9][a-z0-9._:-]*$');
  if (errors.length > 0) throw new Error(errors.join('\n'));
}

function loadEngagementPolicy(policyPath) {
  let policy;
  try { policy = readJsonAbs(resolveRepoPath(policyPath)); } catch (err) { throw new Error(`FAIL-CLOSED: Could not load engagement policy at ${policyPath}: ${err.message}`); }
  try { validateContract(CONTRACTS.engagementPolicy[0], policy, `engagement policy at ${policyPath}`); } catch (err) { throw new Error(`FAIL-CLOSED: Engagement policy at ${policyPath} failed schema validation. ${err.message}`); }
  if (policy.authority && policy.authority.delegationAllowed !== false) throw new Error('FAIL-CLOSED: engagement policy delegationAllowed must be false until signed delegation policy exists.');
  return policy;
}
function checkListContains(list, value) { return Array.isArray(list) && list.includes(value); }
function checkEngagementAuthorized(policy, args) {
  const targetAuthorized = checkListContains(policy.authorizedTargets, args.target);
  const surfaceAuthorized = checkListContains(policy.authorizedSurfaces, args.surface);
  const modeAuthorized = checkListContains(policy.authorizedModes, INIT_MODE);
  const boundaryTargetAuthorized = policy.targetBoundary && checkListContains(policy.targetBoundary.authorizedTargets, args.target);
  if (!targetAuthorized || !surfaceAuthorized || !modeAuthorized || !boundaryTargetAuthorized) {
    throw new Error([
      `FAIL-CLOSED: Target "${args.target}" / surface "${args.surface}" / mode "${INIT_MODE}" is not authorized by the loaded engagement policy.`,
      `Authorized targets: ${(policy.authorizedTargets || []).join(', ') || '(none)'}.`,
      `Authorized boundary targets: ${((policy.targetBoundary && policy.targetBoundary.authorizedTargets) || []).join(', ') || '(none)'}.`,
      `Authorized surfaces: ${(policy.authorizedSurfaces || []).join(', ') || '(none)'}.`,
      `Authorized modes: ${(policy.authorizedModes || []).join(', ') || '(none)'}.`,
    ].join(' '));
  }
  if (policy.authorizedModes.includes('live_engage') && !policy.michaelApprovalRequiredForModes.includes('live_engage')) {
    throw new Error('FAIL-CLOSED: engagement policy authorizes live_engage but does not require Michael approval for live_engage.');
  }
  return true;
}

function loadGraphFixture(graphPath) {
  let graph;
  try { graph = readJsonAbs(resolveRepoPath(graphPath)); } catch (err) { throw new Error(`Could not load synthetic graph fixture at ${graphPath}: ${err.message}`); }
  if (graph.syntheticOnly !== true) throw new Error('FAIL-CLOSED: graph fixture must declare syntheticOnly=true for init-graph-robustness.');
  return graph;
}

function createSyntheticEvent(graph, now) {
  return {
    schemaVersion: '0.1.0',
    eventType: 'scope_d.synthetic_atomic_observation',
    generatedAt: now,
    atomicTestId: 'atomic-graph-robustness-edge-injection',
    atomicTestName: 'Synthetic graph robustness edge-injection observation',
    source: 'scope-d.graph-robustness.synthetic',
    eventName: 'SyntheticGraphRobustnessObservation',
    fields: {
      graphId: graph.id,
      graphType: graph.graphType,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      perturbationType: graph.perturbation.type,
      perturbationBudget: graph.perturbation.budget,
    },
    safety: { mode: 'synthetic_event', blockedInProduction: true, liveExecution: false },
    expectedDetections: [{ ruleRef: 'graph-robustness-hardening-synthetic', shouldAlert: true, maximumLatencySeconds: 300 }],
  };
}

function createGraphRobustnessAssessment(slug, graph, now) {
  return {
    schemaVersion: '0.1.0',
    id: `graph-robustness-${slug}-edge-injection`,
    graph: {
      graphType: graph.graphType,
      sourceRef: 'graph-fixture.synthetic.json',
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      builtAt: now,
    },
    perturbationModel: {
      type: graph.perturbation.type,
      budget: graph.perturbation.budget,
      syntheticOnly: true,
    },
    robustnessScore: graph.expectedResult.robustnessScore,
    confidenceImpact: graph.expectedResult.confidenceImpact,
    affectedDecisions: graph.expectedResult.decisionAffected ? [graph.protectedDecision] : [],
    recommendedHardeningControls: [
      'Reject trust edges that bypass policy authority nodes.',
      'Require receipt-capture edge for all policy-mediated agent actions.',
      'Score critical-path stability after every graph update.',
    ],
    evidenceRefs: [graph.id],
  };
}

function createEventIr(slug, args, graph, event, assessment, now) {
  return {
    schemaVersion: '0.1.0',
    eventId: `evt-${slug}-graph-robustness`,
    kind: 'SYNTHETIC_ATOMIC_OBSERVATION',
    surface: 'synthetic_lab',
    scope: { name: args.target, environment: args.environment, tenantScope: 'lab', well: 'graph-robustness-synthetic-lab' },
    observedAt: now,
    actor: { actorType: 'synthetic', id: 'synthetic-agent:scope-d-graph-robustness', display: 'SCOPE-D synthetic graph robustness runner' },
    resource: { resourceType: 'synthetic_graph_fixture', resourceId: graph.id, redactionState: 'synthetic' },
    facets: { network: { protocol: 'graph.synthetic', destination: graph.id, egressClass: 'synthetic' } },
    safetyClass: 'synthetic_only',
    payload: { syntheticEvent: event, graphRobustnessAssessment: assessment.id },
    provenance: { collector: 'scope-d:init-graph-robustness', traceId: `trace-${slug}`, sourceRef: 'graph-fixture.synthetic.json', hash: sha256Value(graph) },
  };
}

function createIdentityIr(slug, eventIr, assessment, proofId, now) {
  return {
    schemaVersion: '0.1.0',
    identityIrId: `identity-ir-${slug}-graph-robustness`,
    subject: { subjectId: `synthetic-graph:${assessment.graph.sourceRef}`, entityType: 'synthetic', tenantScope: 'lab', redactionState: 'synthetic' },
    eventRefs: [eventIr.eventId],
    primes: [{
      primeId: `prime-policy-${slug}-graph-critical-path`,
      primeType: 'policy',
      label: 'Synthetic graph critical-path policy prime',
      wells: ['graph-robustness-synthetic-lab'],
      evidenceRefs: [eventIr.eventId, assessment.id],
      coherence: 0.85,
      featureVector: [assessment.robustnessScore, assessment.perturbationModel.budget, assessment.affectedDecisions.length],
      archetypeFamily: 'graph_edge_injection_v1',
      configVolumeClass: 'small',
      configVolumeEstimate: assessment.perturbationModel.budget,
    }],
    wells: ['graph-robustness-synthetic-lab'],
    dpBudgetState: { epsilonMax: 0, epsilonUsed: 0, deltaMax: 0, deltaUsed: 0, queries: 0 },
    proofRefs: [proofId],
    observedAt: now,
    safetyMode: 'synthetic_only',
    provenance: { collector: 'scope-d:init-graph-robustness', traceId: eventIr.provenance.traceId, sourceRef: 'event-ir.jsonl', hash: sha256Value(eventIr) },
  };
}

function createProofArtifact(slug, args, eventIr, identityIr, assessment, now) {
  return {
    schemaVersion: '0.1.0',
    proofId: `proof-${slug}-graph-robustness-edge-injection`,
    claim: {
      claimId: `claim.graph_robustness.${claimSlug(args.target)}.edge_injection`,
      claimType: 'dynamic_metric',
      statement: 'Synthetic graph perturbation is detected, critical-path confidence impact is bounded, and hardening controls are linked to policy/identity evidence.',
      epistemicLevel: 'synthetic',
    },
    status: 'SYNTHETIC_ONLY',
    safetyMode: 'synthetic_only',
    targetRefs: [args.target, assessment.id],
    evidenceRefs: [eventIr.eventId, identityIr.identityIrId, assessment.id],
    identityRefs: [identityIr.identityIrId],
    eventRefs: [eventIr.eventId],
    domains: ['synthetic', 'graph'],
    invariants: [
      { name: 'synthetic_graph_only', result: 'pass', details: { syntheticOnly: true } },
      { name: 'graph_robustness_assessment_emitted', result: 'pass', details: { graphRobustnessAssessment: assessment.id } },
      { name: 'critical_path_decision_recorded', result: 'pass', details: { affectedDecisions: assessment.affectedDecisions } },
      { name: 'no_live_graph_attack_tooling', result: 'pass', details: { liveExecution: false } },
    ],
    dynamicMetric: {
      metricType: 'graph_path_cost',
      observedToSecure: 1 - assessment.robustnessScore,
      observedToNearestKnownBad: assessment.robustnessScore,
      unit: 'synthetic-critical-path-perturbation',
      confidence: 0.8,
    },
    configurationVolume: {
      volumeClass: 'small',
      estimate: assessment.perturbationModel.budget,
      estimationMethod: 'bounded_enumeration',
      polytopeRef: 'synthetic-trust-graph-edge-injection-space-v1',
      notes: 'Toy bounded enumeration over a single injected bypass edge in a synthetic trust graph.',
    },
    archetype: { family: 'graph_edge_injection_v1', coefficientHash: 'sha256:synthetic-graph-edge-injection-v1', qualitativeTag: 'matches_known_bad_pattern' },
    witness: { eventIr: eventIr.eventId, identityIr: identityIr.identityIrId, graphRobustnessAssessment: assessment.id, mode: 'synthetic_only' },
    createdAt: now,
    provenance: { producer: 'scope-d:init-graph-robustness', toolVersion: '0.1.0', sourceRef: 'graph-robustness-assessment.json', hash: sha256Value(assessment) },
  };
}

function main() {
  const args = parseArgs(process.argv);
  ensureSafeInputs(args);
  const engagementPolicy = loadEngagementPolicy(args.engagementPolicy);
  checkEngagementAuthorized(engagementPolicy, args);
  const graph = loadGraphFixture(args.graphFixture);
  const now = new Date().toISOString();
  const runId = args.runId || `scope-d-${timestampSlug()}-graph-robustness-synthetic-lab`;
  const slug = localSlug(runId);
  const runRel = path.join('runs', runId);
  const runAbs = path.join(ROOT, runRel);
  if (fs.existsSync(runAbs)) throw new Error(`Run directory already exists: ${runRel}`);

  const safetyBoundary = readJsonRel(path.join(EXAMPLE_DIR, 'safety-boundary.example.json'));
  safetyBoundary.surface.identifier = args.target;
  safetyBoundary.surface.environment = args.environment;
  safetyBoundary.auditSink.path = path.join(runRel, 'events.jsonl');

  const targetManifest = { schemaVersion: '0.1.0', target: { surfaceType: args.surface, identifier: args.target, environment: args.environment }, createdAt: now, safetyBoundaryRef: 'safety-boundary.json', notes: 'Generated by scope-d:init-graph-robustness. Synthetic graph robustness run only. Authorized by engagement-policy.json.' };
  const event = createSyntheticEvent(graph, now);
  const assessment = createGraphRobustnessAssessment(slug, graph, now);
  const eventIr = createEventIr(slug, args, graph, event, assessment, now);
  const proofId = `proof-${slug}-graph-robustness-edge-injection`;
  const identityIr = createIdentityIr(slug, eventIr, assessment, proofId, now);
  const proofArtifact = createProofArtifact(slug, args, eventIr, identityIr, assessment, now);

  const controlLoop = {
    schemaVersion: '0.1.0', runId, loopType: 'graph_robustness_assessment', targetSurface: { surfaceType: args.surface, identifier: args.target, tenantScope: 'lab', environment: args.environment }, status: 'completed', safetyMode: 'synthetic_only', riskScore: 'medium', startedAt: now, completedAt: now,
    gates: [
      { id: 'gate-engagement-policy', gateType: 'scope_approval', decision: 'approved', requiredActor: 'policy_engine', actualActor: engagementPolicy.policyId, reason: `Engagement policy authorized target ${args.target}, surface ${args.surface}, mode ${INIT_MODE}.`, policyDecisionRef: 'engagement-policy.json', timestamp: now },
      { id: 'gate-synthetic-graph-robustness-boundary', gateType: 'analysis_approval', decision: 'auto_continue', requiredActor: 'system', actualActor: 'scope-d:init-graph-robustness', reason: 'Synthetic graph perturbation assessment; no live graph attack tooling or external data.', timestamp: now }
    ],
    evidence: [
      { id: 'ev-engagement-policy', collector: 'scope-d:init-graph-robustness', surface: args.surface, resourceType: 'engagement_policy', resourceId: engagementPolicy.policyId, observedAt: now, claimLevel: 'guaranteed', redactionState: 'synthetic', tenantScope: 'lab', evidence: engagementPolicy, rawRef: 'engagement-policy.json' },
      { id: 'ev-graph-fixture', collector: 'scope-d:init-graph-robustness', surface: args.surface, resourceType: 'synthetic_graph_fixture', resourceId: graph.id, observedAt: now, claimLevel: 'guaranteed', redactionState: 'synthetic', tenantScope: 'lab', evidence: graph, rawRef: 'graph-fixture.synthetic.json' },
      { id: 'ev-synthetic-graph-event', collector: 'scope-d:init-graph-robustness', surface: args.surface, resourceType: 'synthetic_graph_event', resourceId: event.atomicTestId, observedAt: now, claimLevel: 'guaranteed', redactionState: 'synthetic', tenantScope: 'lab', evidence: event, rawRef: 'events.jsonl' },
      { id: 'ev-graph-robustness-assessment', collector: 'scope-d:init-graph-robustness', surface: args.surface, resourceType: 'graph_robustness_assessment', resourceId: assessment.id, observedAt: now, claimLevel: 'guaranteed', redactionState: 'synthetic', tenantScope: 'lab', evidence: assessment, rawRef: 'graph-robustness-assessment.json' },
      { id: 'ev-event-ir-graph-robustness', collector: 'scope-d:init-graph-robustness', surface: args.surface, resourceType: 'event_ir_record', resourceId: eventIr.eventId, observedAt: now, claimLevel: 'guaranteed', redactionState: 'synthetic', tenantScope: 'lab', evidence: eventIr, rawRef: 'event-ir.jsonl' },
      { id: 'ev-identity-ir-graph-robustness', collector: 'scope-d:init-graph-robustness', surface: args.surface, resourceType: 'identity_ir_record', resourceId: identityIr.identityIrId, observedAt: now, claimLevel: 'guaranteed', redactionState: 'synthetic', tenantScope: 'lab', evidence: identityIr, rawRef: 'identity-ir.json' },
      { id: 'ev-proof-artifact-graph-robustness', collector: 'scope-d:init-graph-robustness', surface: args.surface, resourceType: 'proof_artifact', resourceId: proofArtifact.proofId, observedAt: now, claimLevel: 'guaranteed', redactionState: 'synthetic', tenantScope: 'lab', evidence: proofArtifact, rawRef: 'proof-artifact.json' }
    ],
    artifacts: [
      { id: 'artifact-engagement-policy', artifactType: 'policy', path: 'engagement-policy.json' },
      { id: 'artifact-graph-fixture', artifactType: 'json', path: 'graph-fixture.synthetic.json' },
      { id: 'artifact-events', artifactType: 'jsonl', path: 'events.jsonl' },
      { id: 'artifact-graph-robustness-assessment', artifactType: 'json', path: 'graph-robustness-assessment.json' },
      { id: 'artifact-event-ir', artifactType: 'jsonl', path: 'event-ir.jsonl' },
      { id: 'artifact-identity-ir', artifactType: 'json', path: 'identity-ir.json' },
      { id: 'artifact-proof-artifact', artifactType: 'json', path: 'proof-artifact.json' },
      { id: 'artifact-report', artifactType: 'report', path: 'report.md' }
    ],
    controls: [], attackGraph: { nodes: [], edges: [], paths: [] }
  };

  validateContract(CONTRACTS.targetManifest[0], targetManifest, 'target-manifest.json');
  validateContract(CONTRACTS.engagementPolicy[0], engagementPolicy, 'engagement-policy.json');
  validateContract(CONTRACTS.syntheticEvent[0], event, 'events.jsonl synthetic event');
  validateContract(CONTRACTS.graphRobustnessAssessment[0], assessment, 'graph-robustness-assessment.json');
  validateContract(CONTRACTS.eventIr[0], eventIr, 'event-ir.jsonl Event-IR record');
  validateContract(CONTRACTS.identityIr[0], identityIr, 'identity-ir.json');
  validateContract(CONTRACTS.proofArtifact[0], proofArtifact, 'proof-artifact.json');
  validateContract(CONTRACTS.safetyBoundary[0], safetyBoundary, 'safety-boundary.json');
  validateContract(CONTRACTS.controlLoop[0], controlLoop, 'control-loop.json');

  fs.mkdirSync(runAbs, { recursive: true });
  writeJson(path.join(runAbs, 'engagement-policy.json'), engagementPolicy);
  writeJson(path.join(runAbs, 'target-manifest.json'), targetManifest);
  writeJson(path.join(runAbs, 'safety-boundary.json'), safetyBoundary);
  writeJson(path.join(runAbs, 'graph-fixture.synthetic.json'), graph);
  appendJsonl(path.join(runAbs, 'events.jsonl'), event);
  writeJson(path.join(runAbs, 'graph-robustness-assessment.json'), assessment);
  appendJsonl(path.join(runAbs, 'event-ir.jsonl'), eventIr);
  writeJson(path.join(runAbs, 'identity-ir.json'), identityIr);
  writeJson(path.join(runAbs, 'proof-artifact.json'), proofArtifact);
  writeJson(path.join(runAbs, 'control-loop.json'), controlLoop);

  const report = ['# SCOPE-D Graph Robustness Synthetic Run Report', '', `Run ID: ${runId}`, `Target: ${args.target}`, `Engagement policy: ${engagementPolicy.policyId}`, `Graph: ${graph.id}`, '', '## Safety', '', '- Mode: synthetic_only', '- Live execution: false', '- Credentials: none', '- Network egress: none', '- Public scanning: false', '- Graph attack tooling: synthetic fixture only', '', '## Findings', '', `- GraphRobustnessAssessment: ${assessment.id}`, `- Robustness score: ${assessment.robustnessScore}`, `- Confidence impact: ${assessment.confidenceImpact}`, `- ProofArtifact: ${proofArtifact.proofId}`, ''].join('\n');
  fs.writeFileSync(path.join(runAbs, 'report.md'), report, 'utf8');

  const artifactFiles = ['engagement-policy.json', 'target-manifest.json', 'safety-boundary.json', 'graph-fixture.synthetic.json', 'events.jsonl', 'graph-robustness-assessment.json', 'event-ir.jsonl', 'identity-ir.json', 'proof-artifact.json', 'control-loop.json', 'report.md'];
  const receipt = { schemaVersion: '0.1.0', id: `receipt-${runId.replace(/^scope-d-/, '')}`, runId, status: 'completed', artifactHashes: artifactFiles.map((file) => ({ path: path.join(runRel, file), sha256: sha256File(path.join(runAbs, file)) })), policyDecisions: ['gate-engagement-policy', 'gate-synthetic-graph-robustness-boundary'], safetySummary: { mode: 'synthetic_only', liveActionsExecuted: 0, destructiveActionsBlocked: 0, notes: 'Synthetic graph robustness run generated locally; no live graph attack tooling, credentials, external data, or deployments were executed.' }, issuedAt: now, signature: { algorithm: 'none', keyId: 'local-synthetic-graph-robustness-run', value: 'unsigned-local-receipt' } };
  validateContract(CONTRACTS.receipt[0], receipt, 'receipt.json');
  writeJson(path.join(runAbs, 'receipt.json'), receipt);

  console.log(`Created SCOPE-D graph robustness synthetic run: ${runRel}`);
}

try { main(); } catch (err) { console.error(`scope-d:init-graph-robustness failed: ${err.message}`); process.exit(1); }
