#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_DIR = 'config/schemas';
const EXAMPLE_DIR = 'examples/scope-d';
const DEFAULT_MANIFEST = 'fixtures/synthetic/mcp-tool-manifest.tool-poisoning.synthetic.json';
const INIT_MODE = 'synthetic_only';

const CONTRACTS = {
  targetManifest: ['target-manifest.schema.json', 'target-manifest.json'],
  engagementPolicy: ['engagement-policy.schema.json', 'engagement-policy.json'],
  syntheticEvent: ['synthetic-event.schema.json', 'events.jsonl'],
  eventIr: ['event-ir.schema.json', 'event-ir.jsonl'],
  identityIr: ['identity-ir.schema.json', 'identity-ir.json'],
  proofArtifact: ['proof-artifact.schema.json', 'proof-artifact.json'],
  aiInfraAssessment: ['ai-infra-assessment.schema.json', 'ai-infra-assessment.json'],
  mcpToolRisk: ['mcp-tool-risk.schema.json', 'mcp-tool-risk.json'],
  countermeasureRule: ['countermeasure-rule.schema.json', 'countermeasure-rule.json'],
  controlLoop: ['scope-d-control-loop.schema.json', 'control-loop.json'],
  safetyBoundary: ['safety-boundary.schema.json', 'safety-boundary.json'],
  receipt: ['run-receipt.schema.json', 'receipt.json'],
};

function usage() {
  console.log(`Usage: npm run scope-d:init-ai-infra -- --engagement-policy <path> [--target <identifier>] [--manifest <path>] [--run-id <id>]\n\nDefaults:\n  --target local-ai-infra-lab\n  --manifest ${DEFAULT_MANIFEST}\n\nCreates a synthetic-only AI-infra/MCP tool-risk run. FAIL-CLOSED: --engagement-policy is required.`);
}

function parseArgs(argv) {
  const args = {
    target: 'local-ai-infra-lab',
    surface: 'synthetic_lab',
    environment: 'lab',
    runId: null,
    engagementPolicy: null,
    manifest: DEFAULT_MANIFEST,
  };

  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === '--help' || key === '-h') {
      usage();
      process.exit(0);
    }
    if (key === '--target' && val) { args.target = val; i++; continue; }
    if (key === '--manifest' && val) { args.manifest = val; i++; continue; }
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

function readJsonRel(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
}

function readJsonAbs(absPath) {
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
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

function createAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

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
  if (!args.engagementPolicy) {
    errors.push('FAIL-CLOSED: --engagement-policy is required. No fallback to synthetic-only mode when policy path is absent.');
  }
  if (args.environment === 'production' || args.environment === 'customer') {
    errors.push('scope-d:init-ai-infra refuses production/customer environments; use lab/dev/staging/unknown only');
  }
  if (args.surface !== 'synthetic_lab') {
    errors.push('scope-d:init-ai-infra currently supports only synthetic_lab surface');
  }
  if (args.target.length < 1) errors.push('--target must not be empty');
  if (args.runId && !/^scope-d-[a-z0-9][a-z0-9._:-]*$/.test(args.runId)) {
    errors.push('--run-id must match ^scope-d-[a-z0-9][a-z0-9._:-]*$');
  }
  if (errors.length > 0) throw new Error(errors.join('\n'));
}

function loadEngagementPolicy(policyPath) {
  const absPath = resolveRepoPath(policyPath);
  let policy;
  try {
    policy = readJsonAbs(absPath);
  } catch (err) {
    throw new Error(`FAIL-CLOSED: Could not load engagement policy at ${policyPath}: ${err.message}`);
  }

  try {
    validateContract(CONTRACTS.engagementPolicy[0], policy, `engagement policy at ${policyPath}`);
  } catch (err) {
    throw new Error(`FAIL-CLOSED: Engagement policy at ${policyPath} failed schema validation. ${err.message}`);
  }

  if (policy.authority && policy.authority.delegationAllowed !== false) {
    throw new Error('FAIL-CLOSED: engagement policy delegationAllowed must be false until signed delegation policy exists.');
  }

  return policy;
}

function checkListContains(list, value) {
  return Array.isArray(list) && list.includes(value);
}

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

function loadManifest(manifestPath) {
  const absPath = resolveRepoPath(manifestPath);
  let manifest;
  try {
    manifest = readJsonAbs(absPath);
  } catch (err) {
    throw new Error(`Could not load synthetic MCP manifest at ${manifestPath}: ${err.message}`);
  }
  if (manifest.syntheticOnly !== true) {
    throw new Error('FAIL-CLOSED: MCP manifest must declare syntheticOnly=true for init-ai-infra.');
  }
  return manifest;
}

function createSyntheticEvent(manifest, now) {
  return {
    schemaVersion: '0.1.0',
    eventType: 'scope_d.synthetic_atomic_observation',
    generatedAt: now,
    atomicTestId: 'atomic-ai-infra-mcp-tool-risk',
    atomicTestName: 'Synthetic MCP tool boundary and poisoning-risk observation',
    source: 'scope-d.ai-infra.synthetic',
    eventName: 'SyntheticMCPToolRiskObservation',
    fields: {
      serverRef: manifest.serverRef,
      toolName: manifest.toolName,
      permissions: manifest.permissions,
      riskHints: manifest.riskHints,
    },
    safety: {
      mode: 'synthetic_event',
      blockedInProduction: true,
      liveExecution: false,
    },
    expectedDetections: [
      {
        ruleRef: 'countermeasure-mcp-tool-boundary-synthetic',
        shouldAlert: true,
        maximumLatencySeconds: 300,
      },
    ],
  };
}

function createAiInfraAssessment(slug, manifest) {
  return {
    schemaVersion: '0.1.0',
    id: `ai-assessment-${slug}-mcp-tool`,
    target: {
      surfaceType: 'mcp_tool',
      identifier: manifest.toolName,
      environment: manifest.environment || 'lab',
    },
    assessmentMode: 'synthetic_only',
    findings: [
      {
        id: `finding-${slug}-tool-poisoning`,
        category: 'tool_poisoning',
        severity: 'medium',
        confidence: 'high',
        evidence: {
          description: manifest.description,
          riskHints: manifest.riskHints,
          additionalPropertiesAllowed: manifest.argumentSchema && manifest.argumentSchema.additionalProperties === true,
        },
        recommendedCountermeasure: 'Constrain tool description, disable additionalProperties, and require explicit network/capability gates.',
        policyGateRequired: true,
      },
      {
        id: `finding-${slug}-capability-boundary`,
        category: 'capability_boundary',
        severity: 'medium',
        confidence: 'high',
        evidence: {
          permissions: manifest.permissions,
          hasNetworkFetch: (manifest.permissions || []).includes('network.fetch'),
          hasMemoryRead: (manifest.permissions || []).includes('memory.read'),
        },
        recommendedCountermeasure: 'Split read-only memory access from network fetch and require policy approval for combined capability use.',
        policyGateRequired: true,
      },
    ],
  };
}

function createMcpToolRisk(slug, manifest, countermeasureId) {
  return {
    schemaVersion: '0.1.0',
    id: `mcp-risk-${slug}-tool-poisoning`,
    serverRef: manifest.serverRef,
    toolName: manifest.toolName,
    riskCategory: 'tool_poisoning',
    severity: 'medium',
    confidence: 'high',
    evidence: {
      description: manifest.description,
      riskHints: manifest.riskHints,
      argumentSchemaAllowsAdditionalProperties: manifest.argumentSchema && manifest.argumentSchema.additionalProperties === true,
      permissions: manifest.permissions,
    },
    recommendedBoundary: 'synthetic_only; require explicit network, memory, and argument-schema gates before any live use.',
    policyGateRequired: true,
    countermeasureRefs: [countermeasureId],
  };
}

function createCountermeasure(slug, riskId, now) {
  return {
    schemaVersion: '0.1.0',
    id: 'countermeasure-mcp-tool-boundary-synthetic',
    name: 'Synthetic MCP tool boundary recommendation',
    ruleType: 'opa_rego',
    status: 'experimental',
    severity: 'medium',
    sourceFindingRefs: [riskId],
    frameworkMappings: {
      mitreAttack: [],
      mitreAtlas: ['AML.T0051'],
      owaspLLMTop10: ['LLM05', 'LLM06'],
    },
    ruleText: 'package scope_d.synthetic_mcp_tool_boundary\n\ndeny[msg] {\n  input.tool.argumentSchema.additionalProperties == true\n  msg := "MCP tool argument schema permits additional properties"\n}\n\ndeny[msg] {\n  input.tool.permissions[_] == "network.fetch"\n  input.tool.permissions[_] == "memory.read"\n  msg := "MCP tool combines network fetch with memory read without a policy gate"\n}\n',
    expectedEffect: 'Recommendation-only policy sketch for constraining synthetic MCP tool manifest risk.',
    falsePositiveRisk: 'medium',
    validationTestRefs: ['atomic-ai-infra-mcp-tool-risk'],
    deploymentGate: {
      required: true,
      gateType: 'human_and_policy_engine',
    },
    rollbackPlan: {
      required: false,
      steps: [],
    },
    owner: 'scope-d',
    reviewedAt: now,
  };
}

function createEventIr(slug, args, manifest, event, aiAssessment, mcpRisk, countermeasure, now) {
  return {
    schemaVersion: '0.1.0',
    eventId: `evt-${slug}-ai-infra-mcp-risk`,
    kind: 'SYNTHETIC_ATOMIC_OBSERVATION',
    surface: 'synthetic_lab',
    scope: {
      name: args.target,
      environment: args.environment,
      tenantScope: 'lab',
      well: 'ai-infra-synthetic-lab',
    },
    observedAt: now,
    actor: {
      actorType: 'synthetic',
      id: 'synthetic-agent:scope-d-ai-infra',
      display: 'SCOPE-D synthetic AI-infra runner',
    },
    resource: {
      resourceType: 'synthetic_mcp_tool_manifest',
      resourceId: manifest.id,
      redactionState: 'synthetic',
    },
    facets: {
      network: {
        protocol: 'mcp.synthetic',
        destination: manifest.serverRef,
        egressClass: 'synthetic',
      },
    },
    safetyClass: 'synthetic_only',
    payload: {
      syntheticEvent: event,
      aiInfraAssessment: aiAssessment.id,
      mcpToolRisk: mcpRisk.id,
      countermeasure: countermeasure.id,
    },
    provenance: {
      collector: 'scope-d:init-ai-infra',
      traceId: `trace-${slug}`,
      sourceRef: 'mcp-tool-manifest.synthetic.json',
      hash: sha256Value(manifest),
    },
  };
}

function createIdentityIr(slug, eventIr, aiAssessment, mcpRisk, proofId, now) {
  return {
    schemaVersion: '0.1.0',
    identityIrId: `identity-ir-${slug}-ai-infra`,
    subject: {
      subjectId: `synthetic-mcp-tool:${mcpRisk.toolName}`,
      entityType: 'synthetic',
      tenantScope: 'lab',
      redactionState: 'synthetic',
    },
    eventRefs: [eventIr.eventId],
    primes: [
      {
        primeId: `prime-policy-${slug}-mcp-tool`,
        primeType: 'policy',
        label: 'Synthetic MCP capability-boundary prime',
        wells: ['ai-infra-synthetic-lab'],
        evidenceRefs: [eventIr.eventId, aiAssessment.id, mcpRisk.id],
        coherence: 1,
        featureVector: [1, 1, 0],
        archetypeFamily: 'mcp_tool_boundary_v1',
        configVolumeClass: 'small',
        configVolumeEstimate: 2,
      },
      {
        primeId: `prime-semantic-${slug}-tool-poisoning`,
        primeType: 'semantic',
        label: 'Synthetic tool-poisoning semantic prime',
        wells: ['ai-infra-synthetic-lab'],
        evidenceRefs: [eventIr.eventId, mcpRisk.id],
        coherence: 0.9,
        featureVector: [1, 0, 1],
        archetypeFamily: 'tool_poisoning_v1',
        configVolumeClass: 'small',
        configVolumeEstimate: 2,
      },
    ],
    wells: ['ai-infra-synthetic-lab'],
    dpBudgetState: {
      epsilonMax: 0,
      epsilonUsed: 0,
      deltaMax: 0,
      deltaUsed: 0,
      queries: 0,
    },
    proofRefs: [proofId],
    observedAt: now,
    safetyMode: 'synthetic_only',
    provenance: {
      collector: 'scope-d:init-ai-infra',
      traceId: eventIr.provenance.traceId,
      sourceRef: 'event-ir.jsonl',
      hash: sha256Value(eventIr),
    },
  };
}

function createProofArtifact(slug, args, eventIr, identityIr, aiAssessment, mcpRisk, countermeasure, now) {
  return {
    schemaVersion: '0.1.0',
    proofId: `proof-${slug}-ai-infra-mcp-tool-boundary`,
    claim: {
      claimId: `claim.ai_infra.${claimSlug(args.target)}.mcp_tool_boundary`,
      claimType: 'detection_validation',
      statement: 'Synthetic MCP tool manifest risk is detected, bounded to synthetic evidence, linked to identity-prime evidence, and mapped to a recommendation-only countermeasure.',
      epistemicLevel: 'synthetic',
    },
    status: 'SYNTHETIC_ONLY',
    safetyMode: 'synthetic_only',
    targetRefs: [args.target, aiAssessment.id, mcpRisk.id],
    evidenceRefs: [eventIr.eventId, identityIr.identityIrId, aiAssessment.id, mcpRisk.id, countermeasure.id],
    identityRefs: [identityIr.identityIrId],
    eventRefs: [eventIr.eventId],
    domains: ['synthetic', 'semantic_space'],
    invariants: [
      { name: 'synthetic_manifest_only', result: 'pass', details: { syntheticOnly: true } },
      { name: 'mcp_tool_risk_emitted', result: 'pass', details: { mcpToolRisk: mcpRisk.id } },
      { name: 'countermeasure_recommendation_only', result: 'pass', details: { deploymentGate: countermeasure.deploymentGate } },
      { name: 'no_live_network_or_tool_execution', result: 'pass', details: { liveExecution: false } },
    ],
    dynamicMetric: {
      metricType: 'capability_step_cost',
      observedToSecure: 2,
      observedToNearestKnownBad: 1,
      unit: 'synthetic-capability-boundary-step',
      confidence: 0.8,
    },
    configurationVolume: {
      volumeClass: 'small',
      estimate: 2,
      estimationMethod: 'bounded_enumeration',
      polytopeRef: 'synthetic-mcp-permission-schema-space-v1',
      notes: 'Toy bounded enumeration over two unsafe facets: argument additionalProperties and network+memory capability combination.',
    },
    archetype: {
      family: 'mcp_tool_boundary_v1',
      coefficientHash: 'sha256:synthetic-mcp-tool-boundary-v1',
      qualitativeTag: 'matches_known_bad_pattern',
    },
    witness: {
      eventIr: eventIr.eventId,
      identityIr: identityIr.identityIrId,
      aiInfraAssessment: aiAssessment.id,
      mcpToolRisk: mcpRisk.id,
      countermeasure: countermeasure.id,
      mode: 'synthetic_only',
    },
    createdAt: now,
    provenance: {
      producer: 'scope-d:init-ai-infra',
      toolVersion: '0.1.0',
      sourceRef: 'mcp-tool-risk.json',
      hash: sha256Value(mcpRisk),
    },
  };
}

function main() {
  const args = parseArgs(process.argv);
  ensureSafeInputs(args);

  const engagementPolicy = loadEngagementPolicy(args.engagementPolicy);
  checkEngagementAuthorized(engagementPolicy, args);

  const manifest = loadManifest(args.manifest);
  const now = new Date().toISOString();
  const runId = args.runId || `scope-d-${timestampSlug()}-ai-infra-synthetic-lab`;
  const slug = localSlug(runId);
  const runRel = path.join('runs', runId);
  const runAbs = path.join(ROOT, runRel);

  if (fs.existsSync(runAbs)) {
    throw new Error(`Run directory already exists: ${runRel}`);
  }

  const safetyBoundary = readJsonRel(path.join(EXAMPLE_DIR, 'safety-boundary.example.json'));
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
    notes: 'Generated by scope-d:init-ai-infra. Synthetic AI-infra/MCP tool-risk run only. Authorized by engagement-policy.json.',
  };

  const event = createSyntheticEvent(manifest, now);
  const aiAssessment = createAiInfraAssessment(slug, manifest);
  const countermeasure = createCountermeasure(slug, `mcp-risk-${slug}-tool-poisoning`, now);
  const mcpRisk = createMcpToolRisk(slug, manifest, countermeasure.id);
  const eventIr = createEventIr(slug, args, manifest, event, aiAssessment, mcpRisk, countermeasure, now);
  const proofId = `proof-${slug}-ai-infra-mcp-tool-boundary`;
  const identityIr = createIdentityIr(slug, eventIr, aiAssessment, mcpRisk, proofId, now);
  const proofArtifact = createProofArtifact(slug, args, eventIr, identityIr, aiAssessment, mcpRisk, countermeasure, now);

  const controlLoop = {
    schemaVersion: '0.1.0',
    runId,
    loopType: 'ai_infra_assessment',
    targetSurface: {
      surfaceType: args.surface,
      identifier: args.target,
      tenantScope: 'lab',
      environment: args.environment,
    },
    status: 'completed',
    safetyMode: 'synthetic_only',
    riskScore: 'medium',
    startedAt: now,
    completedAt: now,
    gates: [
      {
        id: 'gate-engagement-policy',
        gateType: 'scope_approval',
        decision: 'approved',
        requiredActor: 'policy_engine',
        actualActor: engagementPolicy.policyId,
        reason: `Engagement policy authorized target ${args.target}, surface ${args.surface}, mode ${INIT_MODE}.`,
        policyDecisionRef: 'engagement-policy.json',
        timestamp: now,
      },
      {
        id: 'gate-synthetic-ai-infra-boundary',
        gateType: 'analysis_approval',
        decision: 'auto_continue',
        requiredActor: 'system',
        actualActor: 'scope-d:init-ai-infra',
        reason: 'Synthetic MCP tool-risk assessment; no live tools, network calls, credentials, or external services.',
        timestamp: now,
      },
    ],
    evidence: [
      { id: 'ev-engagement-policy', collector: 'scope-d:init-ai-infra', surface: args.surface, resourceType: 'engagement_policy', resourceId: engagementPolicy.policyId, observedAt: now, claimLevel: 'guaranteed', redactionState: 'synthetic', tenantScope: 'lab', evidence: engagementPolicy, rawRef: 'engagement-policy.json' },
      { id: 'ev-mcp-tool-manifest', collector: 'scope-d:init-ai-infra', surface: args.surface, resourceType: 'synthetic_mcp_tool_manifest', resourceId: manifest.id, observedAt: now, claimLevel: 'guaranteed', redactionState: 'synthetic', tenantScope: 'lab', evidence: manifest, rawRef: 'mcp-tool-manifest.synthetic.json' },
      { id: 'ev-synthetic-ai-infra-event', collector: 'scope-d:init-ai-infra', surface: args.surface, resourceType: 'synthetic_ai_infra_event', resourceId: event.atomicTestId, observedAt: now, claimLevel: 'guaranteed', redactionState: 'synthetic', tenantScope: 'lab', evidence: event, rawRef: 'events.jsonl' },
      { id: 'ev-ai-infra-assessment', collector: 'scope-d:init-ai-infra', surface: args.surface, resourceType: 'ai_infra_assessment', resourceId: aiAssessment.id, observedAt: now, claimLevel: 'guaranteed', redactionState: 'synthetic', tenantScope: 'lab', evidence: aiAssessment, rawRef: 'ai-infra-assessment.json' },
      { id: 'ev-mcp-tool-risk', collector: 'scope-d:init-ai-infra', surface: args.surface, resourceType: 'mcp_tool_risk', resourceId: mcpRisk.id, observedAt: now, claimLevel: 'guaranteed', redactionState: 'synthetic', tenantScope: 'lab', evidence: mcpRisk, rawRef: 'mcp-tool-risk.json' },
      { id: 'ev-event-ir-ai-infra', collector: 'scope-d:init-ai-infra', surface: args.surface, resourceType: 'event_ir_record', resourceId: eventIr.eventId, observedAt: now, claimLevel: 'guaranteed', redactionState: 'synthetic', tenantScope: 'lab', evidence: eventIr, rawRef: 'event-ir.jsonl' },
      { id: 'ev-identity-ir-ai-infra', collector: 'scope-d:init-ai-infra', surface: args.surface, resourceType: 'identity_ir_record', resourceId: identityIr.identityIrId, observedAt: now, claimLevel: 'guaranteed', redactionState: 'synthetic', tenantScope: 'lab', evidence: identityIr, rawRef: 'identity-ir.json' },
      { id: 'ev-proof-artifact-ai-infra', collector: 'scope-d:init-ai-infra', surface: args.surface, resourceType: 'proof_artifact', resourceId: proofArtifact.proofId, observedAt: now, claimLevel: 'guaranteed', redactionState: 'synthetic', tenantScope: 'lab', evidence: proofArtifact, rawRef: 'proof-artifact.json' },
      { id: 'ev-countermeasure-rule-ai-infra', collector: 'scope-d:init-ai-infra', surface: args.surface, resourceType: 'countermeasure_rule', resourceId: countermeasure.id, observedAt: now, claimLevel: 'guaranteed', redactionState: 'synthetic', tenantScope: 'lab', evidence: countermeasure, rawRef: 'countermeasure-rule.json' },
    ],
    artifacts: [
      { id: 'artifact-engagement-policy', artifactType: 'policy', path: 'engagement-policy.json' },
      { id: 'artifact-mcp-tool-manifest', artifactType: 'json', path: 'mcp-tool-manifest.synthetic.json' },
      { id: 'artifact-events', artifactType: 'jsonl', path: 'events.jsonl' },
      { id: 'artifact-ai-infra-assessment', artifactType: 'json', path: 'ai-infra-assessment.json' },
      { id: 'artifact-mcp-tool-risk', artifactType: 'json', path: 'mcp-tool-risk.json' },
      { id: 'artifact-event-ir', artifactType: 'jsonl', path: 'event-ir.jsonl' },
      { id: 'artifact-identity-ir', artifactType: 'json', path: 'identity-ir.json' },
      { id: 'artifact-proof-artifact', artifactType: 'json', path: 'proof-artifact.json' },
      { id: 'artifact-countermeasure-rule', artifactType: 'detection_rule', path: 'countermeasure-rule.json' },
      { id: 'artifact-report', artifactType: 'report', path: 'report.md' },
    ],
    controls: [
      {
        id: countermeasure.id,
        ruleType: countermeasure.ruleType,
        status: countermeasure.status,
        severity: countermeasure.severity,
        sourceFindingRefs: countermeasure.sourceFindingRefs,
        ruleText: countermeasure.ruleText,
        expectedEffect: countermeasure.expectedEffect,
        falsePositiveRisk: countermeasure.falsePositiveRisk,
      },
    ],
    attackGraph: { nodes: [], edges: [], paths: [] },
  };

  validateContract(CONTRACTS.targetManifest[0], targetManifest, 'target-manifest.json');
  validateContract(CONTRACTS.engagementPolicy[0], engagementPolicy, 'engagement-policy.json');
  validateContract(CONTRACTS.syntheticEvent[0], event, 'events.jsonl synthetic event');
  validateContract(CONTRACTS.aiInfraAssessment[0], aiAssessment, 'ai-infra-assessment.json');
  validateContract(CONTRACTS.mcpToolRisk[0], mcpRisk, 'mcp-tool-risk.json');
  validateContract(CONTRACTS.countermeasureRule[0], countermeasure, 'countermeasure-rule.json');
  validateContract(CONTRACTS.eventIr[0], eventIr, 'event-ir.jsonl Event-IR record');
  validateContract(CONTRACTS.identityIr[0], identityIr, 'identity-ir.json');
  validateContract(CONTRACTS.proofArtifact[0], proofArtifact, 'proof-artifact.json');
  validateContract(CONTRACTS.safetyBoundary[0], safetyBoundary, 'safety-boundary.json');
  validateContract(CONTRACTS.controlLoop[0], controlLoop, 'control-loop.json');

  fs.mkdirSync(runAbs, { recursive: true });
  writeJson(path.join(runAbs, 'engagement-policy.json'), engagementPolicy);
  writeJson(path.join(runAbs, 'target-manifest.json'), targetManifest);
  writeJson(path.join(runAbs, 'safety-boundary.json'), safetyBoundary);
  writeJson(path.join(runAbs, 'mcp-tool-manifest.synthetic.json'), manifest);
  appendJsonl(path.join(runAbs, 'events.jsonl'), event);
  writeJson(path.join(runAbs, 'ai-infra-assessment.json'), aiAssessment);
  writeJson(path.join(runAbs, 'mcp-tool-risk.json'), mcpRisk);
  writeJson(path.join(runAbs, 'countermeasure-rule.json'), countermeasure);
  appendJsonl(path.join(runAbs, 'event-ir.jsonl'), eventIr);
  writeJson(path.join(runAbs, 'identity-ir.json'), identityIr);
  writeJson(path.join(runAbs, 'proof-artifact.json'), proofArtifact);
  writeJson(path.join(runAbs, 'control-loop.json'), controlLoop);

  const report = [
    '# SCOPE-D AI-Infra Synthetic Run Report',
    '',
    `Run ID: ${runId}`,
    `Target: ${args.target}`,
    `Engagement policy: ${engagementPolicy.policyId}`,
    `MCP tool: ${manifest.toolName}`,
    '',
    '## Safety',
    '',
    '- Mode: synthetic_only',
    '- Live execution: false',
    '- Credentials: none',
    '- Network egress: none',
    '- Public scanning: false',
    '- Countermeasure deployment: recommendation only',
    '',
    '## Findings',
    '',
    `- AIInfraAssessment: ${aiAssessment.id}`,
    `- MCPToolRisk: ${mcpRisk.id}`,
    `- CountermeasureRule: ${countermeasure.id}`,
    `- ProofArtifact: ${proofArtifact.proofId}`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(runAbs, 'report.md'), report, 'utf8');

  const artifactFiles = [
    'engagement-policy.json',
    'target-manifest.json',
    'safety-boundary.json',
    'mcp-tool-manifest.synthetic.json',
    'events.jsonl',
    'ai-infra-assessment.json',
    'mcp-tool-risk.json',
    'countermeasure-rule.json',
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
    policyDecisions: ['gate-engagement-policy', 'gate-synthetic-ai-infra-boundary'],
    safetySummary: {
      mode: 'synthetic_only',
      liveActionsExecuted: 0,
      destructiveActionsBlocked: 0,
      notes: 'Synthetic AI-infra MCP tool-risk run generated locally; no live tools, network calls, credentials, or deployments were executed.',
    },
    issuedAt: now,
    signature: {
      algorithm: 'none',
      keyId: 'local-synthetic-ai-infra-run',
      value: 'unsigned-local-receipt',
    },
  };

  validateContract(CONTRACTS.receipt[0], receipt, 'receipt.json');
  writeJson(path.join(runAbs, 'receipt.json'), receipt);

  console.log(`Created SCOPE-D AI-infra synthetic run: ${runRel}`);
  console.log('Artifacts: engagement-policy.json, target-manifest.json, safety-boundary.json, mcp-tool-manifest.synthetic.json, events.jsonl, ai-infra-assessment.json, mcp-tool-risk.json, countermeasure-rule.json, event-ir.jsonl, identity-ir.json, proof-artifact.json, control-loop.json, report.md, receipt.json');
}

try {
  main();
} catch (err) {
  console.error(`scope-d:init-ai-infra failed: ${err.message}`);
  process.exit(1);
}
