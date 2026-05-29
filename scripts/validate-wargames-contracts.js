#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED_PRIMES = ['p2', 'p3', 'p5', 'p7', 'p11', 'p13', 'p17', 'p19', 'p23', 'p29', 'p31'];
const EXPECTED_DIMS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'];
const EXPECTED_TOPICS = Array.from({ length: 23 }, (_, i) => `T${i + 1}`);

const VALID_PAIRS = [
  ['config/schemas/wargames-mode.schema.json', 'examples/scope-d/wargames/defense-run.example.json'],
  ['config/schemas/wargames-mode.schema.json', 'examples/scope-d/wargames/learning-run.example.json'],
  ['config/schemas/boundary-event.schema.json', 'examples/scope-d/wargames/boundary-event-net-header.example.json'],
  ['config/schemas/evidence.schema.json', 'examples/scope-d/wargames/evidence-header-summary.example.json'],
  ['config/schemas/negative-evidence.schema.json', 'examples/scope-d/wargames/negative-evidence-missing-validator.example.json'],
  ['config/schemas/scout-profile-proof.schema.json', 'examples/scope-d/wargames/scout-profile-proof.example.json'],
  ['config/schemas/engagement-trigger.schema.json', 'examples/scope-d/wargames/engagement-trigger-contained.example.json'],
  ['config/schemas/engagement-authorization.schema.json', 'examples/scope-d/wargames/engagement-authorization-approved.example.json'],
  ['config/schemas/wargames-lsa-lsi-map.schema.json', 'examples/scope-d/wargames/wargames-lsa-map.example.json'],
  ['config/schemas/wargames-synapseiq-enrichment.schema.json', 'examples/scope-d/wargames/wargames-synapseiq-enrichment.example.json'],
  ['config/schemas/wargames-ofif-activation-envelope.schema.json', 'examples/scope-d/wargames/wargames-ofif-activation-envelope.example.json'],
  ['config/schemas/wargames-attack-coverage-claim.schema.json', 'examples/scope-d/wargames/wargames-attack-coverage-claim.example.json'],
  ['config/schemas/wargames-ontogenesis-export-envelope.schema.json', 'examples/scope-d/wargames/wargames-ontogenesis-export.example.json'],
  ['config/schemas/wargames-meshrush-graph-view-export.schema.json', 'examples/scope-d/wargames/wargames-meshrush-graph-view.example.json'],
  ['config/schemas/wargames-hellgraph-proof-stream.schema.json', 'examples/scope-d/wargames/wargames-hellgraph-proof-stream.example.json'],
  ['config/schemas/wargames-adversarial-scenario.schema.json', 'examples/scope-d/wargames/wargames-adversarial-scenario.example.json'],
];

const INVALID_PAIRS = [
  ['config/schemas/wargames-mode.schema.json', 'examples/scope-d/wargames/negative-fixtures/learning-run-raw.invalid.json'],
  ['config/schemas/engagement-authorization.schema.json', 'examples/scope-d/wargames/negative-fixtures/engagement-authorization-missing-michael.invalid.json'],
  ['config/schemas/scout-profile-proof.schema.json', 'examples/scope-d/wargames/negative-fixtures/scout-profile-proof-unsafe.invalid.json'],
  ['config/schemas/wargames-lsa-lsi-map.schema.json', 'examples/scope-d/wargames/negative-fixtures/wargames-lsa-map-raw-identity.invalid.json'],
  ['config/schemas/wargames-ofif-activation-envelope.schema.json', 'examples/scope-d/wargames/negative-fixtures/ofif-envelope-unauthorized.invalid.json'],
  ['config/schemas/wargames-ofif-activation-envelope.schema.json', 'examples/scope-d/wargames/negative-fixtures/ofif-envelope-invalid-topics.invalid.json'],
  ['config/schemas/wargames-synapseiq-enrichment.schema.json', 'examples/scope-d/wargames/negative-fixtures/synapseiq-enrichment-claims-execution.invalid.json'],
  ['config/schemas/wargames-ofif-activation-envelope.schema.json', 'examples/scope-d/wargames/negative-fixtures/ofif-envelope-raw-identity-join.invalid.json'],
  ['config/schemas/wargames-attack-coverage-claim.schema.json', 'examples/scope-d/wargames/negative-fixtures/attack-coverage-claims-procedure-execution.invalid.json'],
  ['config/schemas/wargames-ontogenesis-export-envelope.schema.json', 'examples/scope-d/wargames/negative-fixtures/ontogenesis-export-authorizes-activation.invalid.json'],
  ['config/schemas/wargames-meshrush-graph-view-export.schema.json', 'examples/scope-d/wargames/negative-fixtures/meshrush-graph-view-runtime-authority.invalid.json'],
  ['config/schemas/wargames-hellgraph-proof-stream.schema.json', 'examples/scope-d/wargames/negative-fixtures/hellgraph-proof-stream-replay-executed.invalid.json'],
  ['config/schemas/wargames-adversarial-scenario.schema.json', 'examples/scope-d/wargames/negative-fixtures/adversarial-scenario-attack-only.invalid.json'],
  ['config/schemas/wargames-adversarial-scenario.schema.json', 'examples/scope-d/wargames/negative-fixtures/adversarial-scenario-memory-writeback.invalid.json'],
  ['config/schemas/wargames-adversarial-scenario.schema.json', 'examples/scope-d/wargames/negative-fixtures/adversarial-scenario-synthetic-promotion.invalid.json'],
  ['config/schemas/wargames-adversarial-scenario.schema.json', 'examples/scope-d/wargames/negative-fixtures/adversarial-scenario-summary-only-finding.invalid.json'],
];

const APPROVED_AUTHORIZATION_EXAMPLE = 'examples/scope-d/wargames/engagement-authorization-approved.example.json';
const APPROVED_SYNAPSEIQ_EXAMPLE = 'examples/scope-d/wargames/wargames-synapseiq-enrichment.example.json';
const APPROVED_ATTACK_COVERAGE_EXAMPLE = 'examples/scope-d/wargames/wargames-attack-coverage-claim.example.json';

const globalErrors = [];

function readJson(relPath, localErrors = globalErrors) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) {
    localErrors.push(`Missing file: ${relPath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    localErrors.push(`Invalid JSON in ${relPath}: ${err.message}`);
    return null;
  }
}

function assertTo(errorList, condition, message) {
  if (!condition) errorList.push(message);
}

function sameSet(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((item) => right.includes(item));
}

function validateSchemaShape(schemaPath, schema, errorList) {
  if (!schema) return;
  assertTo(errorList, schema.$schema === 'https://json-schema.org/draft/2020-12/schema', `${schemaPath}: schema must use draft 2020-12`);
  assertTo(errorList, typeof schema.$id === 'string' && schema.$id.includes('socioprophet.org/schemas/'), `${schemaPath}: missing SocioProphet $id`);
  assertTo(errorList, schema.type === 'object', `${schemaPath}: top-level schema must be object`);
  assertTo(errorList, schema.additionalProperties === false, `${schemaPath}: top-level additionalProperties must be false`);
  assertTo(errorList, Array.isArray(schema.required) && schema.required.length > 0, `${schemaPath}: required[] must be non-empty`);
  assertTo(errorList, schema.properties && typeof schema.properties === 'object', `${schemaPath}: properties object required`);
}

function formatAjvErrors(validate) {
  return (validate.errors || []).map((err) => {
    const loc = err.instancePath || '/';
    return `${loc} ${err.message}`;
  }).join('; ');
}

function validateWargamesMode(examplePath, example, errorList) {
  if (!examplePath.includes('defense-run') && !examplePath.includes('learning-run')) return;
  assertTo(errorList, example.scopeAuthorization && example.scopeAuthorization.authorized === true, `${examplePath}: Wargames run must have explicit authorization`);
  assertTo(errorList, example.safetyBoundaryRef && example.safetyBoundaryRef.length > 0, `${examplePath}: safetyBoundaryRef is required`);
  assertTo(errorList, Array.isArray(example.evidenceRefs) && example.evidenceRefs.length > 0, `${examplePath}: evidenceRefs must be non-empty`);
  assertTo(errorList, Array.isArray(example.proofRefs) && example.proofRefs.length > 0, `${examplePath}: proofRefs must be non-empty`);

  if (example.mode === 'LEARNING') {
    assertTo(errorList, example.redactionState !== 'raw', `${examplePath}: LEARNING mode must not use raw redactionState`);
    assertTo(errorList, Array.isArray(example.learningCorpusRefs) && example.learningCorpusRefs.length > 0, `${examplePath}: LEARNING mode requires learningCorpusRefs`);
    assertTo(errorList, Array.isArray(example.reproducibilityRefs) && example.reproducibilityRefs.length > 0, `${examplePath}: LEARNING mode requires reproducibilityRefs`);
    assertTo(errorList, Array.isArray(example.sourceRunRefs) && example.sourceRunRefs.length > 0, `${examplePath}: LEARNING mode requires sourceRunRefs`);
  }
}

function validateBoundaryEvent(examplePath, example, errorList) {
  if (!examplePath.includes('boundary-event')) return;
  assertTo(errorList, example.redactionState !== 'raw', `${examplePath}: boundary-event example must not store raw data`);
  assertTo(errorList, Array.isArray(example.evidenceRefs) && example.evidenceRefs.length > 0, `${examplePath}: boundary-event requires evidenceRefs`);
  assertTo(errorList, example.boundaryScope !== 'outside' || Boolean(example.authorizationRef), `${examplePath}: outside-boundary examples require authorizationRef`);
}

function validateEvidence(examplePath, example, errorList) {
  if (!examplePath.includes('evidence-header-summary')) return;
  assertTo(errorList, example.sensitiveContentStored === false, `${examplePath}: sensitiveContentStored must be false`);
  assertTo(errorList, example.redactionState !== 'raw', `${examplePath}: evidence example must not be raw`);
  assertTo(errorList, example.recordRef !== null, `${examplePath}: direct evidence should have recordRef`);
}

function validateNegativeEvidence(examplePath, example, errorList) {
  if (!examplePath.includes('negative-evidence')) return;
  assertTo(errorList, example.recordRef === null, `${examplePath}: negative evidence must have recordRef=null`);
  assertTo(errorList, Array.isArray(example.expectedSources) && example.expectedSources.length > 0, `${examplePath}: negative evidence requires expectedSources`);
  assertTo(errorList, example.redactionState !== 'raw', `${examplePath}: negative evidence must not be raw`);
  assertTo(errorList, example.reviewRequired === true, `${examplePath}: negative evidence example should require review`);
}

function validateScoutProof(examplePath, example, errorList) {
  if (!examplePath.includes('scout-profile-proof')) return;
  assertTo(errorList, example.redactionState !== 'raw', `${examplePath}: Scout proof must not be raw`);
  assertTo(errorList, example.metrics && example.metrics.schemaValidPct >= 0.9, `${examplePath}: Scout proof schemaValidPct must be >= 0.9`);
  assertTo(errorList, example.metrics && example.metrics.coveragePct >= 0.9, `${examplePath}: Scout proof coveragePct must be >= 0.9`);
  const safety = example.safety || {};
  assertTo(errorList, safety.payloadBodiesCaptured === false, `${examplePath}: Scout proof must record payloadBodiesCaptured=false`);
  assertTo(errorList, safety.credentialCollectionAllowed === false, `${examplePath}: Scout proof must prohibit credential collection`);
  assertTo(errorList, safety.publicNetworkScanningAllowed === false, `${examplePath}: Scout proof must prohibit public network scanning`);
}

function validateEngagementTrigger(examplePath, example, errorList) {
  if (!examplePath.includes('engagement-trigger')) return;
  assertTo(errorList, Array.isArray(example.evidenceRefs) && example.evidenceRefs.length > 0, `${examplePath}: engagement trigger requires evidenceRefs`);
  assertTo(errorList, Array.isArray(example.boundaryEventRefs) && example.boundaryEventRefs.length > 0, `${examplePath}: engagement trigger requires boundaryEventRefs`);
  assertTo(errorList, example.confidence >= 0.5, `${examplePath}: engagement trigger confidence should be >= 0.5 for the example`);
  if (['E4', 'E5', 'E6'].includes(example.recommendedEngagementLevel)) {
    assertTo(errorList, Boolean(example.authorizationRef), `${examplePath}: E4/E5/E6 triggers require authorizationRef`);
  }
}

function validateEngagementAuthorization(examplePath, example, errorList) {
  if (!examplePath.includes('engagement-authorization')) return;
  assertTo(errorList, example.approvalStatus === 'approved', `${examplePath}: approved authorization example must have approvalStatus=approved`);
  assertTo(errorList, Array.isArray(example.approvedBy) && example.approvedBy.includes('Michael Heller'), `${examplePath}: E4/E5/E6 authorization requires Michael Heller approval until delegated policy exists`);
  assertTo(errorList, example.michaelOnlyRequired === true, `${examplePath}: michaelOnlyRequired must be true until delegated policy exists`);
  assertTo(errorList, Array.isArray(example.prohibitedActions) && example.prohibitedActions.includes('credential_collection'), `${examplePath}: prohibitedActions must include credential_collection`);
  assertTo(errorList, Array.isArray(example.prohibitedActions) && example.prohibitedActions.includes('destructive_action'), `${examplePath}: prohibitedActions must include destructive_action`);
  assertTo(errorList, Array.isArray(example.prohibitedActions) && example.prohibitedActions.includes('third_party_access'), `${examplePath}: prohibitedActions must include third_party_access`);
}

function validateLsaLsiMap(examplePath, example, errorList) {
  if (!examplePath.includes('wargames-lsa-map')) return;
  const topics = example.topics || [];
  const topicIds = topics.map((topic) => topic.topicId);
  assertTo(errorList, topicIds.length === 23, `${examplePath}: LSA/LSI map must contain exactly 23 topics`);
  assertTo(errorList, new Set(topicIds).size === topicIds.length, `${examplePath}: topic IDs must be unique`);
  assertTo(errorList, sameSet(topicIds, EXPECTED_TOPICS), `${examplePath}: topic IDs must cover T1..T23 exactly`);
  assertTo(errorList, sameSet(example.primeSet || [], EXPECTED_PRIMES), `${examplePath}: primeSet must be p2..p31 exactly`);
  assertTo(errorList, example.redactionPolicy && example.redactionPolicy.rawIdentityJoinsAllowed === false, `${examplePath}: rawIdentityJoinsAllowed must be false`);

  const topicSet = new Set(topicIds);
  for (const topic of topics) {
    assertTo(errorList, sameSet(topic.lsaDims || [], EXPECTED_DIMS), `${examplePath}: ${topic.topicId} must carry L1..L10 exactly`);
    assertTo(errorList, sameSet(topic.lsiAnchors || [], EXPECTED_PRIMES), `${examplePath}: ${topic.topicId} must carry all 11 prime anchors exactly`);
    assertTo(errorList, topic.implementationState !== 'runtime_backed', `${examplePath}: ${topic.topicId} must not claim runtime backing in this contract slice`);
  }

  for (const edge of example.crossTopicEdges || []) {
    assertTo(errorList, topicSet.has(edge.fromTopic), `${examplePath}: edge fromTopic ${edge.fromTopic} must exist`);
    assertTo(errorList, topicSet.has(edge.toTopic), `${examplePath}: edge toTopic ${edge.toTopic} must exist`);
  }
}

function validateSynapseiqEnrichment(examplePath, example, errorList) {
  if (!examplePath.includes('synapseiq-enrichment')) return;
  assertTo(errorList, example.runtimeAuthority === false, `${examplePath}: SynapseIQ enrichment must not claim runtime authority`);
  assertTo(errorList, example.liveLookupPerformed === false, `${examplePath}: SynapseIQ enrichment must not perform live lookup in contract examples`);
  assertTo(errorList, example.modelMutationPerformed === false, `${examplePath}: SynapseIQ enrichment must not perform model mutation`);
  assertTo(errorList, example.engagementDecisionAuthority === false, `${examplePath}: SynapseIQ enrichment must not make engagement decisions`);
  assertTo(errorList, example.redactionState !== 'raw', `${examplePath}: SynapseIQ enrichment must not be raw`);
  assertTo(errorList, Array.isArray(example.enrichmentNonClaims) && example.enrichmentNonClaims.includes('does_not_perform_live_lookup'), `${examplePath}: enrichment non-claims must include does_not_perform_live_lookup`);
  assertTo(errorList, Array.isArray(example.enrichmentNonClaims) && example.enrichmentNonClaims.includes('does_not_make_engagement_decisions'), `${examplePath}: enrichment non-claims must include does_not_make_engagement_decisions`);
}

function validateOfifActivationEnvelope(examplePath, example, errorList) {
  if (!examplePath.includes('ofif-envelope') && !examplePath.includes('wargames-ofif-activation-envelope')) return;
  assertTo(errorList, example.rawIdentityJoinsAllowed === false, `${examplePath}: OFIF envelope must not allow raw identity joins`);
  assertTo(errorList, example.runtimeAuthority === false, `${examplePath}: OFIF envelope must not claim runtime authority`);
  assertTo(errorList, example.liveDeliveryExecuted === false, `${examplePath}: OFIF envelope must not execute live delivery`);
  assertTo(errorList, example.redactionState !== 'raw', `${examplePath}: OFIF envelope must not be raw`);
  assertTo(errorList, Array.isArray(example.nonClaims) && example.nonClaims.includes('does_not_execute_engagement'), `${examplePath}: OFIF non-claims must include does_not_execute_engagement`);
  assertTo(errorList, Array.isArray(example.nonClaims) && example.nonClaims.includes('does_not_authorize_action_without_engagement_authorization'), `${examplePath}: OFIF non-claims must include does_not_authorize_action_without_engagement_authorization`);

  if (example.deliveryClass === 'engagement_ready') {
    assertTo(errorList, Array.isArray(example.evidenceRefs) && example.evidenceRefs.length >= 2, `${examplePath}: engagement_ready requires at least two evidence refs`);
    assertTo(errorList, Boolean(example.scoutProofRef), `${examplePath}: engagement_ready requires scoutProofRef`);
    assertTo(errorList, Boolean(example.synapseiqEnrichmentRef), `${examplePath}: engagement_ready requires synapseiqEnrichmentRef`);
    assertTo(errorList, Boolean(example.engagementAuthorizationRef), `${examplePath}: engagement_ready requires engagementAuthorizationRef`);

    const auth = readJson(APPROVED_AUTHORIZATION_EXAMPLE, errorList);
    if (auth && example.engagementAuthorizationRef) {
      assertTo(errorList, auth.authorizationId === example.engagementAuthorizationRef, `${examplePath}: engagementAuthorizationRef must point to the approved authorization example`);
      assertTo(errorList, auth.approvalStatus === 'approved', `${examplePath}: referenced authorization must be approved`);
      assertTo(errorList, Array.isArray(auth.approvedBy) && auth.approvedBy.includes('Michael Heller'), `${examplePath}: referenced authorization must include Michael Heller approval`);
    }
  }

  const enrichment = readJson(APPROVED_SYNAPSEIQ_EXAMPLE, errorList);
  if (enrichment && example.synapseiqEnrichmentRef) {
    assertTo(errorList, enrichment.enrichmentId === example.synapseiqEnrichmentRef, `${examplePath}: synapseiqEnrichmentRef must point to the approved enrichment example`);
    assertTo(errorList, enrichment.runtimeAuthority === false, `${examplePath}: referenced enrichment must not claim runtime authority`);
    assertTo(errorList, enrichment.engagementDecisionAuthority === false, `${examplePath}: referenced enrichment must not make engagement decisions`);
  }
}

function validateAttackCoverageClaim(examplePath, example, errorList) {
  if (!examplePath.includes('attack-coverage')) return;
  assertTo(errorList, example.runtimeAuthority === false, `${examplePath}: ATT&CK coverage claim must not claim runtime authority`);
  assertTo(errorList, example.procedureExecutionAuthority === false, `${examplePath}: ATT&CK coverage claim must not claim procedure execution authority`);
  assertTo(errorList, example.engagementAuthorizationAuthority === false, `${examplePath}: ATT&CK coverage claim must not authorize engagement`);
  assertTo(errorList, example.redactionState !== 'raw', `${examplePath}: ATT&CK coverage claim must not be raw`);
  assertTo(errorList, Array.isArray(example.semanticNonClaims) && example.semanticNonClaims.includes('does_not_execute_attack_procedure'), `${examplePath}: semantic non-claims must include does_not_execute_attack_procedure`);
  assertTo(errorList, Array.isArray(example.semanticNonClaims) && example.semanticNonClaims.includes('does_not_authorize_engagement'), `${examplePath}: semantic non-claims must include does_not_authorize_engagement`);
}

function validateOntogenesisExport(examplePath, example, errorList) {
  if (!examplePath.includes('ontogenesis-export')) return;
  assertTo(errorList, example.runtimeAuthority === false, `${examplePath}: Ontogenesis export must not claim runtime authority`);
  assertTo(errorList, example.procedureExecutionAuthority === false, `${examplePath}: Ontogenesis export must not claim procedure execution authority`);
  assertTo(errorList, example.engagementAuthorizationAuthority === false, `${examplePath}: Ontogenesis export must not authorize engagement`);
  assertTo(errorList, example.activationAllowed === false, `${examplePath}: Ontogenesis export must not activate client delivery`);
  assertTo(errorList, example.redactionState !== 'raw', `${examplePath}: Ontogenesis export must not be raw`);
  assertTo(errorList, Array.isArray(example.semanticNonClaims) && example.semanticNonClaims.includes('does_not_execute_attack_procedure'), `${examplePath}: semantic non-claims must include does_not_execute_attack_procedure`);
  assertTo(errorList, Array.isArray(example.semanticNonClaims) && example.semanticNonClaims.includes('does_not_authorize_engagement'), `${examplePath}: semantic non-claims must include does_not_authorize_engagement`);
  assertTo(errorList, Array.isArray(example.semanticNonClaims) && example.semanticNonClaims.includes('does_not_activate_client_delivery'), `${examplePath}: semantic non-claims must include does_not_activate_client_delivery`);

  const claim = readJson(APPROVED_ATTACK_COVERAGE_EXAMPLE, errorList);
  if (claim && Array.isArray(example.coverageClaimRefs)) {
    assertTo(errorList, example.coverageClaimRefs.includes(claim.claimId), `${examplePath}: export should reference the approved ATT&CK coverage claim example`);
    assertTo(errorList, claim.runtimeAuthority === false, `${examplePath}: referenced coverage claim must not claim runtime authority`);
    assertTo(errorList, claim.engagementAuthorizationAuthority === false, `${examplePath}: referenced coverage claim must not authorize engagement`);
  }
}

function validateMeshrushGraphView(examplePath, example, errorList) {
  if (!examplePath.includes('meshrush')) return;
  assertTo(errorList, example.rawIdentityJoinsAllowed === false, `${examplePath}: MeshRush export must not allow raw identity joins`);
  assertTo(errorList, example.runtimeConnectionEstablished === false, `${examplePath}: MeshRush export must not establish runtime connection`);
  assertTo(errorList, example.traversalAuthority === false, `${examplePath}: MeshRush export must not claim traversal authority`);
  assertTo(errorList, example.mutationAuthority === false, `${examplePath}: MeshRush export must not claim mutation authority`);
  assertTo(errorList, example.redactionState !== 'raw', `${examplePath}: MeshRush export must not be raw`);
  assertTo(errorList, Array.isArray(example.nonClaims) && example.nonClaims.includes('does_not_establish_runtime_connection'), `${examplePath}: non-claims must include does_not_establish_runtime_connection`);
  assertTo(errorList, Array.isArray(example.nonClaims) && example.nonClaims.includes('does_not_execute_graph_traversal'), `${examplePath}: non-claims must include does_not_execute_graph_traversal`);
  assertTo(errorList, Array.isArray(example.nonClaims) && example.nonClaims.includes('does_not_authorize_mutation'), `${examplePath}: non-claims must include does_not_authorize_mutation`);
}

function validateHellgraphProofStream(examplePath, example, errorList) {
  if (!examplePath.includes('hellgraph')) return;
  assertTo(errorList, example.rawIdentityJoinsAllowed === false, `${examplePath}: HellGraph proof stream must not allow raw identity joins`);
  assertTo(errorList, example.runtimeConnectionEstablished === false, `${examplePath}: HellGraph proof stream must not establish runtime connection`);
  assertTo(errorList, example.replayExecuted === false, `${examplePath}: HellGraph proof stream must not execute replay`);
  assertTo(errorList, example.mutationAuthority === false, `${examplePath}: HellGraph proof stream must not claim mutation authority`);
  assertTo(errorList, example.ordered === true, `${examplePath}: HellGraph proof stream must be ordered`);
  assertTo(errorList, example.redactionState !== 'raw', `${examplePath}: HellGraph proof stream must not be raw`);
  assertTo(errorList, Array.isArray(example.nonClaims) && example.nonClaims.includes('does_not_establish_runtime_connection'), `${examplePath}: non-claims must include does_not_establish_runtime_connection`);
  assertTo(errorList, Array.isArray(example.nonClaims) && example.nonClaims.includes('does_not_execute_replay'), `${examplePath}: non-claims must include does_not_execute_replay`);
  assertTo(errorList, Array.isArray(example.nonClaims) && example.nonClaims.includes('does_not_authorize_mutation'), `${examplePath}: non-claims must include does_not_authorize_mutation`);
}

function validateAdversarialScenario(examplePath, example, errorList) {
  if (!examplePath.includes('adversarial-scenario')) return;

  assertTo(errorList, example.runtimeAuthority === false, `${examplePath}: adversarial scenario must not claim runtime authority`);
  assertTo(errorList, example.procedureExecutionAuthority === false, `${examplePath}: adversarial scenario must not claim procedure execution authority`);
  assertTo(errorList, example.engagementAuthorizationAuthority === false, `${examplePath}: adversarial scenario must not authorize engagement`);
  assertTo(errorList, example.activationAllowed === false, `${examplePath}: adversarial scenario must not activate downstream delivery`);
  assertTo(errorList, example.redactionState !== 'raw', `${examplePath}: adversarial scenario must not be raw`);
  assertTo(errorList, Array.isArray(example.safetyBoundaryRefs) && example.safetyBoundaryRefs.length > 0, `${examplePath}: adversarial scenario requires safetyBoundaryRefs`);
  assertTo(errorList, Array.isArray(example.evidenceRefs) && example.evidenceRefs.length > 0, `${examplePath}: adversarial scenario requires evidenceRefs`);
  assertTo(errorList, Array.isArray(example.semanticNonClaims) && example.semanticNonClaims.includes('does_not_execute_attack_procedure'), `${examplePath}: semantic non-claims must include does_not_execute_attack_procedure`);
  assertTo(errorList, Array.isArray(example.semanticNonClaims) && example.semanticNonClaims.includes('does_not_authorize_engagement'), `${examplePath}: semantic non-claims must include does_not_authorize_engagement`);

  const hasInterfaceCrossing = Array.isArray(example.interfaceCrossings) && example.interfaceCrossings.length > 0;
  const hasHumanInterpretation = example.humanInterpretation && example.humanInterpretation.required === true && example.humanInterpretation.reviewRequired === true;
  const hasMachineInterpretation = example.machineInterpretation && example.machineInterpretation.required === true && example.machineInterpretation.abstentionRequired === true;
  const hasMemoryEffect = Array.isArray(example.memoryEffects) && example.memoryEffects.some((effect) => effect.effectType !== 'none');
  const hasRuntimeReceipt = Array.isArray(example.runtimeDecisionReceiptRefs) && example.runtimeDecisionReceiptRefs.length > 0;
  const hasCounterfactual = Array.isArray(example.counterfactuals) && example.counterfactuals.length > 0;
  const claimPromotion = example.claimPromotion || {};
  const requiredEvidence = Array.isArray(claimPromotion.requiredEvidence) ? claimPromotion.requiredEvidence : [];
  const evidenceRefs = Array.isArray(example.evidenceRefs) ? example.evidenceRefs : [];
  const summaryOnlyEvidence = requiredEvidence.length > 0 && requiredEvidence.every((item) => /summary|model-generated/i.test(item));
  const modelSummaryRefs = evidenceRefs.some((ref) => /model-summary|summary-only/i.test(ref));

  if (Array.isArray(example.attackCoverageClaimRefs) && example.attackCoverageClaimRefs.length > 0) {
    assertTo(errorList, hasInterfaceCrossing || hasHumanInterpretation || hasMachineInterpretation || hasCounterfactual, `${examplePath}: ATT&CK/local coverage must be subordinate to scenario semantics`);
    assertTo(errorList, hasRuntimeReceipt, `${examplePath}: coverage-bearing scenario should reference a runtime decision receipt`);
  }

  if (example.scenarioClass === 'workspace_transduction') {
    assertTo(errorList, hasInterfaceCrossing, `${examplePath}: workspace_transduction requires at least one interface crossing`);
    assertTo(errorList, hasHumanInterpretation, `${examplePath}: workspace_transduction requires human interpretation review`);
  }

  if (example.scenarioClass === 'agentic_tool_misbinding') {
    assertTo(errorList, hasMachineInterpretation, `${examplePath}: agentic_tool_misbinding requires machine interpretation abstention`);
  }

  if (hasMemoryEffect) {
    for (const effect of example.memoryEffects) {
      assertTo(errorList, effect.writebackAllowed === false, `${examplePath}: memory effects must not allow writeback in Wargames examples`);
      assertTo(errorList, effect.proposalRequired === true, `${examplePath}: memory effects require Memory Mesh proposal routing`);
      assertTo(errorList, effect.reviewState === 'pending_review' || effect.reviewState === 'blocked', `${examplePath}: memory effects must remain pending_review or blocked`);
      assertTo(errorList, Boolean(effect.proposalRef), `${examplePath}: memory effects require proposalRef`);
    }
  }

  if (example.redactionState === 'synthetic') {
    assertTo(errorList, claimPromotion.state !== 'finding' && claimPromotion.state !== 'reportable', `${examplePath}: synthetic scenarios must not be finding/reportable without a non-production report boundary`);
    assertTo(errorList, claimPromotion.reportAllowed === false, `${examplePath}: synthetic scenarios must not allow report promotion in this contract layer`);
    assertTo(errorList, example.semanticNonClaims.includes('does_not_establish_production_observation'), `${examplePath}: synthetic scenarios must state does_not_establish_production_observation`);
  }

  assertTo(errorList, claimPromotion.state !== 'finding', `${examplePath}: scenario examples must not enter finding state`);
  assertTo(errorList, !(summaryOnlyEvidence || modelSummaryRefs), `${examplePath}: summary/model-generated evidence cannot be the only finding-grade evidence`);
  assertTo(errorList, claimPromotion.findingAllowed === false, `${examplePath}: scenario examples must not allow finding promotion`);
  assertTo(errorList, claimPromotion.policyUpdateAllowed === false, `${examplePath}: scenario examples must not allow policy update`);
  assertTo(errorList, claimPromotion.memoryUpdateAllowed === false, `${examplePath}: scenario examples must not allow memory update`);
  assertTo(errorList, example.capabilityExposure && Object.values(example.capabilityExposure).every((value) => value === false), `${examplePath}: scenario examples must not expose live capabilities`);
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const schemaCache = new Map();

function getCompiledSchema(schemaPath, errorList) {
  if (schemaCache.has(schemaPath)) return schemaCache.get(schemaPath);
  const schema = readJson(schemaPath, errorList);
  validateSchemaShape(schemaPath, schema, errorList);
  if (!schema) return null;
  try {
    const validate = ajv.compile(schema);
    schemaCache.set(schemaPath, validate);
    return validate;
  } catch (err) {
    errorList.push(`${schemaPath}: AJV failed to compile schema: ${err.message}`);
    return null;
  }
}

function validatePair(schemaPath, examplePath) {
  const localErrors = [];
  const example = readJson(examplePath, localErrors);
  const validate = getCompiledSchema(schemaPath, localErrors);
  if (!validate || !example) return localErrors;

  if (!validate(example)) {
    localErrors.push(`${examplePath}: failed ${schemaPath}: ${formatAjvErrors(validate)}`);
  }

  validateWargamesMode(examplePath, example, localErrors);
  validateBoundaryEvent(examplePath, example, localErrors);
  validateEvidence(examplePath, example, localErrors);
  validateNegativeEvidence(examplePath, example, localErrors);
  validateScoutProof(examplePath, example, localErrors);
  validateEngagementTrigger(examplePath, example, localErrors);
  validateEngagementAuthorization(examplePath, example, localErrors);
  validateLsaLsiMap(examplePath, example, localErrors);
  validateSynapseiqEnrichment(examplePath, example, localErrors);
  validateOfifActivationEnvelope(examplePath, example, localErrors);
  validateAttackCoverageClaim(examplePath, example, localErrors);
  validateOntogenesisExport(examplePath, example, localErrors);
  validateMeshrushGraphView(examplePath, example, localErrors);
  validateHellgraphProofStream(examplePath, example, localErrors);
  validateAdversarialScenario(examplePath, example, localErrors);

  return localErrors;
}

for (const [schemaPath, examplePath] of VALID_PAIRS) {
  const pairErrors = validatePair(schemaPath, examplePath);
  if (pairErrors.length > 0) {
    globalErrors.push(...pairErrors);
  }
}

for (const [schemaPath, examplePath] of INVALID_PAIRS) {
  const pairErrors = validatePair(schemaPath, examplePath);
  if (pairErrors.length === 0) {
    globalErrors.push(`${examplePath}: invalid fixture unexpectedly passed ${schemaPath}`);
  }
}

if (globalErrors.length > 0) {
  console.error('Wargames contract validation failed:');
  for (const err of globalErrors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(`Wargames contract validation passed (${VALID_PAIRS.length} valid pairs, ${INVALID_PAIRS.length} invalid fixtures rejected).`);
