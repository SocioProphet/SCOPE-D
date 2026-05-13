#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');

const REQUIRED_PAIRS = [
  ['config/schemas/wargames-mode.schema.json', 'examples/scope-d/wargames/defense-run.example.json'],
  ['config/schemas/wargames-mode.schema.json', 'examples/scope-d/wargames/learning-run.example.json'],
  ['config/schemas/boundary-event.schema.json', 'examples/scope-d/wargames/boundary-event-net-header.example.json'],
  ['config/schemas/evidence.schema.json', 'examples/scope-d/wargames/evidence-header-summary.example.json'],
  ['config/schemas/negative-evidence.schema.json', 'examples/scope-d/wargames/negative-evidence-missing-validator.example.json'],
  ['config/schemas/scout-profile-proof.schema.json', 'examples/scope-d/wargames/scout-profile-proof.example.json'],
];

const errors = [];

function readJson(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) {
    errors.push(`Missing file: ${relPath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    errors.push(`Invalid JSON in ${relPath}: ${err.message}`);
    return null;
  }
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function validateSchemaShape(schemaPath, schema) {
  if (!schema) return;
  assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', `${schemaPath}: schema must use draft 2020-12`);
  assert(typeof schema.$id === 'string' && schema.$id.includes('socioprophet.org/schemas/'), `${schemaPath}: missing SocioProphet $id`);
  assert(schema.type === 'object', `${schemaPath}: top-level schema must be object`);
  assert(schema.additionalProperties === false, `${schemaPath}: top-level additionalProperties must be false`);
  assert(Array.isArray(schema.required) && schema.required.length > 0, `${schemaPath}: required[] must be non-empty`);
  assert(schema.properties && typeof schema.properties === 'object', `${schemaPath}: properties object required`);
}

function formatAjvErrors(validate) {
  return (validate.errors || []).map((err) => {
    const loc = err.instancePath || '/';
    return `${loc} ${err.message}`;
  }).join('; ');
}

function validateWargamesMode(examplePath, example) {
  if (!example || !examplePath.includes('wargames')) return;
  assert(example.scopeAuthorization && example.scopeAuthorization.authorized === true, `${examplePath}: Wargames examples must have explicit authorization`);
  assert(example.safetyBoundaryRef && example.safetyBoundaryRef.length > 0, `${examplePath}: safetyBoundaryRef is required`);
  assert(Array.isArray(example.evidenceRefs) && example.evidenceRefs.length > 0, `${examplePath}: evidenceRefs must be non-empty`);
  assert(Array.isArray(example.proofRefs) && example.proofRefs.length > 0, `${examplePath}: proofRefs must be non-empty`);

  if (example.mode === 'LEARNING') {
    assert(example.redactionState !== 'raw', `${examplePath}: LEARNING mode must not use raw redactionState`);
    assert(Array.isArray(example.learningCorpusRefs) && example.learningCorpusRefs.length > 0, `${examplePath}: LEARNING mode requires learningCorpusRefs`);
    assert(Array.isArray(example.reproducibilityRefs) && example.reproducibilityRefs.length > 0, `${examplePath}: LEARNING mode requires reproducibilityRefs`);
    assert(Array.isArray(example.sourceRunRefs) && example.sourceRunRefs.length > 0, `${examplePath}: LEARNING mode requires sourceRunRefs`);
  }
}

function validateBoundaryEvent(examplePath, example) {
  if (!examplePath.includes('boundary-event')) return;
  assert(example.redactionState !== 'raw', `${examplePath}: boundary-event example must not store raw data`);
  assert(Array.isArray(example.evidenceRefs) && example.evidenceRefs.length > 0, `${examplePath}: boundary-event requires evidenceRefs`);
  assert(example.boundaryScope !== 'outside' || Boolean(example.authorizationRef), `${examplePath}: outside-boundary examples require authorizationRef`);
}

function validateEvidence(examplePath, example) {
  if (!examplePath.includes('evidence-header-summary')) return;
  assert(example.sensitiveContentStored === false, `${examplePath}: sensitiveContentStored must be false`);
  assert(example.redactionState !== 'raw', `${examplePath}: evidence example must not be raw`);
  assert(example.recordRef !== null, `${examplePath}: direct evidence should have recordRef`);
}

function validateNegativeEvidence(examplePath, example) {
  if (!examplePath.includes('negative-evidence')) return;
  assert(example.recordRef === null, `${examplePath}: negative evidence must have recordRef=null`);
  assert(Array.isArray(example.expectedSources) && example.expectedSources.length > 0, `${examplePath}: negative evidence requires expectedSources`);
  assert(example.redactionState !== 'raw', `${examplePath}: negative evidence must not be raw`);
  assert(example.reviewRequired === true, `${examplePath}: negative evidence example should require review`);
}

function validateScoutProof(examplePath, example) {
  if (!examplePath.includes('scout-profile-proof')) return;
  assert(example.redactionState !== 'raw', `${examplePath}: Scout proof must not be raw`);
  assert(example.metrics && example.metrics.schemaValidPct >= 0.9, `${examplePath}: Scout proof schemaValidPct must be >= 0.9`);
  assert(example.metrics && example.metrics.coveragePct >= 0.9, `${examplePath}: Scout proof coveragePct must be >= 0.9`);
  const safety = example.safety || {};
  assert(safety.payloadBodiesCaptured === false, `${examplePath}: Scout proof must record payloadBodiesCaptured=false`);
  assert(safety.credentialCollectionAllowed === false, `${examplePath}: Scout proof must prohibit credential collection`);
  assert(safety.publicNetworkScanningAllowed === false, `${examplePath}: Scout proof must prohibit public network scanning`);
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

for (const [schemaPath, examplePath] of REQUIRED_PAIRS) {
  const schema = readJson(schemaPath);
  const example = readJson(examplePath);
  validateSchemaShape(schemaPath, schema);
  if (!schema || !example) continue;

  let validate;
  try {
    validate = ajv.compile(schema);
  } catch (err) {
    errors.push(`${schemaPath}: AJV failed to compile schema: ${err.message}`);
    continue;
  }

  if (!validate(example)) {
    errors.push(`${examplePath}: failed ${schemaPath}: ${formatAjvErrors(validate)}`);
  }

  validateWargamesMode(examplePath, example);
  validateBoundaryEvent(examplePath, example);
  validateEvidence(examplePath, example);
  validateNegativeEvidence(examplePath, example);
  validateScoutProof(examplePath, example);
}

if (errors.length > 0) {
  console.error('Wargames contract validation failed:');
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(`Wargames contract validation passed (${REQUIRED_PAIRS.length} AJV schema/example pairs).`);
