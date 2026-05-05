#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const REQUIRED_PAIRS = [
  ['config/schemas/scope-d-control-loop.schema.json', 'examples/scope-d/control-loop.example.json'],
  ['config/schemas/purple-team-exercise.schema.json', 'examples/scope-d/purple-team-exercise.example.json'],
  ['config/schemas/atomic-testcase.schema.json', 'examples/scope-d/atomic-testcase.example.json'],
  ['config/schemas/threat-intel-feed.schema.json', 'examples/scope-d/threat-intel-feed.example.json'],
  ['config/schemas/ai-infra-assessment.schema.json', 'examples/scope-d/ai-infra-assessment.example.json'],
  ['config/schemas/graph-robustness-assessment.schema.json', 'examples/scope-d/graph-robustness-assessment.example.json'],
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

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
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

function validateRequiredFields(schemaPath, examplePath, schema, example) {
  if (!schema || !example || !Array.isArray(schema.required)) return;
  for (const field of schema.required) {
    assert(hasOwn(example, field), `${examplePath}: missing required top-level field '${field}' from ${schemaPath}`);
  }
}

function validateSafetyInvariants(examplePath, example) {
  if (!example) return;

  if (examplePath.includes('atomic-testcase')) {
    const safety = example.safety || {};
    assert(safety.blockedInProduction === true, `${examplePath}: atomic examples must be blockedInProduction=true`);
    assert(Array.isArray(safety.allowedModes), `${examplePath}: safety.allowedModes must be an array`);
    assert(!safety.allowedModes.includes('live_execution'), `${examplePath}: example atomic tests must not allow live_execution`);
    assert(example.executor && example.executor.type === 'synthetic_event', `${examplePath}: example executor must use synthetic_event`);
  }

  if (examplePath.includes('ai-infra-assessment')) {
    assert(['read_only', 'synthetic_only', 'dry_run'].includes(example.assessmentMode), `${examplePath}: example AI assessment must not use live_gated`);
  }

  if (examplePath.includes('control-loop')) {
    assert(['read_only', 'synthetic_only', 'dry_run'].includes(example.safetyMode), `${examplePath}: example control loop must not use write_with_gate or blocked`);
  }

  if (examplePath.includes('purple-team-exercise')) {
    const roe = (example.rulesOfEngagement || []).join('\n').toLowerCase();
    assert(roe.includes('synthetic'), `${examplePath}: rulesOfEngagement should explicitly mention synthetic safety`);
    assert(roe.includes('no live exploit'), `${examplePath}: rulesOfEngagement should explicitly prohibit live exploit execution`);
  }
}

function walkJsonFiles(relDir) {
  const absDir = path.join(ROOT, relDir);
  if (!fs.existsSync(absDir)) return [];
  const out = [];
  const stack = [absDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      if (entry.isFile() && entry.name.endsWith('.json')) out.push(path.relative(ROOT, full));
    }
  }
  return out.sort();
}

for (const file of [...walkJsonFiles('config/schemas'), ...walkJsonFiles('examples')]) {
  readJson(file);
}

for (const [schemaPath, examplePath] of REQUIRED_PAIRS) {
  const schema = readJson(schemaPath);
  const example = readJson(examplePath);
  validateSchemaShape(schemaPath, schema);
  validateRequiredFields(schemaPath, examplePath, schema, example);
  validateSafetyInvariants(examplePath, example);
}

if (errors.length > 0) {
  console.error('SCOPE-D contract validation failed:');
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(`SCOPE-D contract validation passed (${REQUIRED_PAIRS.length} schema/example pairs).`);
