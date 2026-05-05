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

  if (examplePath.includes('emulation-plan')) {
    assert(example.safety && example.safety.defaultMode === 'synthetic_only', `${examplePath}: example emulation plan must default to synthetic_only`);
    const blocked = ((example.safety && example.safety.blockedActions) || []).join('\n').toLowerCase();
    assert(blocked.includes('credential'), `${examplePath}: emulation plan must block credential collection`);
    assert(blocked.includes('public network'), `${examplePath}: emulation plan must block public network scanning`);
  }

  if (examplePath.includes('run-receipt')) {
    assert(example.safetySummary && example.safetySummary.liveActionsExecuted === 0, `${examplePath}: example receipt must record zero live actions`);
  }

  if (examplePath.includes('safety-boundary')) {
    assert(example.defaultMode === 'synthetic_only', `${examplePath}: example boundary must default to synthetic_only`);
    assert(example.credentialBoundary && example.credentialBoundary.secretCollectionAllowed === false, `${examplePath}: example boundary must prohibit secret collection`);
    assert(example.networkBoundary && example.networkBoundary.publicScanningAllowed === false, `${examplePath}: example boundary must prohibit public scanning`);
    assert(example.networkBoundary && example.networkBoundary.egressMode === 'none', `${examplePath}: example boundary must set egressMode=none`);
    assert(example.memoryBoundary && example.memoryBoundary.redactionRequired === true, `${examplePath}: example boundary must require redaction`);
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

function formatAjvErrors(validate) {
  return (validate.errors || []).map((err) => {
    const loc = err.instancePath || '/';
    return `${loc} ${err.message}`;
  }).join('; ');
}

for (const file of [...walkJsonFiles('config/schemas'), ...walkJsonFiles('examples')]) {
  readJson(file);
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

  validateSafetyInvariants(examplePath, example);
}

if (errors.length > 0) {
  console.error('SCOPE-D contract validation failed:');
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(`SCOPE-D contract validation passed (${REQUIRED_PAIRS.length} AJV schema/example pairs).`);
