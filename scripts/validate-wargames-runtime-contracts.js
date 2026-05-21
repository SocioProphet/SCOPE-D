#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');

const PAIRS = [
  ['config/schemas/wargames-invocation-envelope.schema.json', 'examples/scope-d/wargames/runtime/invocation-allow-validate.synthetic.json'],
  ['config/schemas/wargames-invocation-envelope.schema.json', 'examples/scope-d/wargames/runtime/invocation-review-incomplete-evidence.synthetic.json'],
  ['config/schemas/wargames-invocation-envelope.schema.json', 'examples/scope-d/wargames/runtime/negative-fixtures/invocation-raw-identity-join.invalid.json'],
  ['config/schemas/wargames-invocation-envelope.schema.json', 'examples/scope-d/wargames/runtime/negative-fixtures/invocation-missing-michael.invalid.json'],
  ['config/schemas/wargames-invocation-envelope.schema.json', 'examples/scope-d/wargames/runtime/negative-fixtures/invocation-live-execution.invalid.json'],
  ['config/schemas/wargames-runtime-decision-receipt.schema.json', 'examples/scope-d/wargames/runtime/receipt-allow-validate.example.json'],
];

const errors = [];

function readJson(relPath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
  } catch (err) {
    errors.push(`${relPath}: ${err.message}`);
    return null;
  }
}

function schemaShape(schemaPath, schema) {
  if (!schema) return;
  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') errors.push(`${schemaPath}: expected draft 2020-12 schema`);
  if (!String(schema.$id || '').includes('socioprophet.org/schemas/')) errors.push(`${schemaPath}: expected SocioProphet schema id`);
  if (schema.type !== 'object') errors.push(`${schemaPath}: expected top-level object`);
  if (schema.additionalProperties !== false) errors.push(`${schemaPath}: expected additionalProperties=false`);
}

function format(validate) {
  return (validate.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const cache = new Map();

function compiled(schemaPath) {
  if (cache.has(schemaPath)) return cache.get(schemaPath);
  const schema = readJson(schemaPath);
  schemaShape(schemaPath, schema);
  if (!schema) return null;
  try {
    const validate = ajv.compile(schema);
    cache.set(schemaPath, validate);
    return validate;
  } catch (err) {
    errors.push(`${schemaPath}: ${err.message}`);
    return null;
  }
}

for (const [schemaPath, examplePath] of PAIRS) {
  const validate = compiled(schemaPath);
  const example = readJson(examplePath);
  if (!validate || !example) continue;
  if (!validate(example)) errors.push(`${examplePath}: failed ${schemaPath}: ${format(validate)}`);
}

if (errors.length > 0) {
  console.error('Wargames runtime contract validation failed:');
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(`Wargames runtime contract validation passed (${PAIRS.length} schema/example pairs).`);
