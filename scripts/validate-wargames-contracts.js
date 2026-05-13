#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');

const VALID_PAIRS = [
  ['config/schemas/wargames-mode.schema.json', 'examples/scope-d/wargames/defense-run.example.json'],
  ['config/schemas/wargames-mode.schema.json', 'examples/scope-d/wargames/learning-run.example.json'],
  ['config/schemas/boundary-event.schema.json', 'examples/scope-d/wargames/boundary-event-net-header.example.json'],
  ['config/schemas/evidence.schema.json', 'examples/scope-d/wargames/evidence-header-summary.example.json'],
  ['config/schemas/negative-evidence.schema.json', 'examples/scope-d/wargames/negative-evidence-missing-validator.example.json'],
  ['config/schemas/scout-profile-proof.schema.json', 'examples/scope-d/wargames/scout-profile-proof.example.json'],
  ['config/schemas/engagement-trigger.schema.json', 'examples/scope-d/wargames/engagement-trigger-contained.example.json'],
  ['config/schemas/engagement-authorization.schema.json', 'examples/scope-d/wargames/engagement-authorization-approved.example.json'],
];

const INVALID_PAIRS = [
  ['config/schemas/wargames-mode.schema.json', 'examples/scope-d/wargames/negative-fixtures/learning-run-raw.invalid.json'],
  ['config/schemas/engagement-authorization.schema.json', 'examples/scope-d/wargames/negative-fixtures/engagement-authorization-missing-michael.invalid.json'],
  ['config/schemas/scout-profile-proof.schema.json', 'examples/scope-d/wargames/negative-fixtures/scout-profile-proof-unsafe.invalid.json'],
];

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
