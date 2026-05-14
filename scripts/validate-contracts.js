#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');

const REQUIRED_PAIRS = [
  ['config/schemas/scope-d-control-loop.schema.json', 'examples/scope-d/control-loop.example.json'],
  ['config/schemas/purple-team-exercise.schema.json', 'examples/scope-d/purple-team-exercise.example.json'],
  ['config/schemas/atomic-testcase.schema.json', 'examples/scope-d/atomic-testcase.example.json'],
  ['config/schemas/threat-intel-feed.schema.json', 'examples/scope-d/threat-intel-feed.example.json'],
  ['config/schemas/ai-infra-assessment.schema.json', 'examples/scope-d/ai-infra-assessment.example.json'],
  ['config/schemas/graph-robustness-assessment.schema.json', 'examples/scope-d/graph-robustness-assessment.example.json'],
  ['config/schemas/emulation-plan.schema.json', 'examples/scope-d/emulation-plan.example.json'],
  ['config/schemas/countermeasure-rule.schema.json', 'examples/scope-d/countermeasure-rule.example.json'],
  ['config/schemas/mcp-tool-risk.schema.json', 'examples/scope-d/mcp-tool-risk.example.json'],
  ['config/schemas/agent-skill-risk.schema.json', 'examples/scope-d/agent-skill-risk.example.json'],
  ['config/schemas/run-receipt.schema.json', 'examples/scope-d/run-receipt.example.json'],
  ['config/schemas/safety-boundary.schema.json', 'examples/scope-d/safety-boundary.example.json'],
  ['config/schemas/agent-harness-risk-assessment.schema.json', 'examples/scope-d/agent-harness-risk-assessment.example.json'],
  ['config/schemas/event-ir.schema.json', 'examples/scope-d/event-ir.example.json'],
  ['config/schemas/identity-ir.schema.json', 'examples/scope-d/identity-ir.example.json'],
  ['config/schemas/proof-artifact.schema.json', 'examples/scope-d/proof-artifact.example.json'],
  ['config/schemas/engagement-policy.schema.json', 'examples/scope-d/engagement-policy.example.json'],
  ['config/schemas/engagement-policy.schema.json', 'examples/scope-d/engagement-policy.synthetic.json'],
  ['config/schemas/collector-policy.schema.json', 'examples/scope-d/collector-policy.example.json'],
];

const RUNTIME_SCHEMAS = [
  'config/schemas/target-manifest.schema.json',
  'config/schemas/synthetic-event.schema.json',
  'config/schemas/run-summary.schema.json',
  'config/schemas/dashboard-export.schema.json',
  'config/schemas/lsa-map-report.schema.json',
];

const CATALOG_PAIRS = [
  ['config/schemas/reference-framework.schema.json', 'references/scope-d-reference-catalog.json'],
];

const CONFIG_PAIRS = [
  ['config/schemas/scope-d-lsa-map.schema.json', 'config/scope-d-lsa-map.json'],
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

function formatAjvErrors(validate) {
  return (validate.errors || []).map((err) => {
    const loc = err.instancePath || '/';
    return `${loc} ${err.message}`;
  }).join('; ');
}

function validateReferenceCatalog(catalogPath, catalog) {
  if (!catalog || !Array.isArray(catalog.references)) return;
  const ids = new Set();
  for (const ref of catalog.references) {
    assert(!ids.has(ref.id), `${catalogPath}: duplicate reference id ${ref.id}`);
    ids.add(ref.id);
  }
}

function validateLsaMap(configPath, config) {
  if (!config || !Array.isArray(config.topics)) return;
  const ids = new Set();
  for (const topic of config.topics) {
    assert(!ids.has(topic.id), `${configPath}: duplicate topic id ${topic.id}`);
    ids.add(topic.id);
  }
  for (let i = 1; i <= 23; i += 1) {
    assert(ids.has(i), `${configPath}: missing topic id ${i}`);
  }
  for (const edge of config.crossTopicEdges || []) {
    assert(ids.has(edge.from.topic), `${configPath}: crossTopicEdges references unknown from.topic ${edge.from.topic}`);
    assert(ids.has(edge.to.topic), `${configPath}: crossTopicEdges references unknown to.topic ${edge.to.topic}`);
  }
}

for (const file of [...walkJsonFiles('config/schemas'), ...walkJsonFiles('examples'), ...walkJsonFiles('references')]) {
  readJson(file);
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validatorsBySchemaPath = new Map();

function compileValidator(schemaPath, schema) {
  if (validatorsBySchemaPath.has(schemaPath)) return validatorsBySchemaPath.get(schemaPath);
  const validate = ajv.compile(schema);
  validatorsBySchemaPath.set(schemaPath, validate);
  return validate;
}

for (const schemaPath of RUNTIME_SCHEMAS) {
  validateSchemaShape(schemaPath, readJson(schemaPath));
}

for (const [schemaPath, examplePath] of [...REQUIRED_PAIRS, ...CATALOG_PAIRS, ...CONFIG_PAIRS]) {
  const schema = readJson(schemaPath);
  const example = readJson(examplePath);
  validateSchemaShape(schemaPath, schema);
  if (!schema || !example) continue;

  let validate;
  try {
    validate = compileValidator(schemaPath, schema);
  } catch (err) {
    errors.push(`${schemaPath}: AJV failed to compile schema: ${err.message}`);
    continue;
  }

  if (!validate(example)) {
    errors.push(`${examplePath}: failed ${schemaPath}: ${formatAjvErrors(validate)}`);
  }

  if (examplePath.includes('scope-d-reference-catalog')) {
    validateReferenceCatalog(examplePath, example);
  }
  if (examplePath.includes('scope-d-lsa-map')) {
    validateLsaMap(examplePath, example);
  }
}

if (errors.length > 0) {
  console.error('SCOPE-D contract validation failed:');
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(`SCOPE-D contract validation passed (${REQUIRED_PAIRS.length} AJV schema/example pairs, ${CATALOG_PAIRS.length} catalog pair, ${CONFIG_PAIRS.length} config pair, ${RUNTIME_SCHEMAS.length} runtime schemas).`);
