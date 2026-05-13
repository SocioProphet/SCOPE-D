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
];

const RUNTIME_SCHEMAS = [
  'config/schemas/target-manifest.schema.json',
  'config/schemas/synthetic-event.schema.json',
  'config/schemas/run-summary.schema.json',
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

  if (examplePath.includes('agent-harness-risk-assessment')) {
    assert(['read_only', 'synthetic_only', 'dry_run'].includes(example.assessmentMode), `${examplePath}: agent harness risk assessment must be read_only, synthetic_only, or dry_run`);
    const safety = example.safetyBoundary || {};
    assert(safety.liveActionsExecuted === 0, `${examplePath}: agent harness risk assessment must record zero live actions`);
    assert(safety.syntheticOnly === true, `${examplePath}: agent harness risk assessment must be syntheticOnly=true`);
    assert(safety.credentialCollectionAllowed === false, `${examplePath}: credential collection must be prohibited`);
    assert(safety.publicNetworkScanningAllowed === false, `${examplePath}: public network scanning must be prohibited`);
    assert(safety.destructiveActionsAllowed === false, `${examplePath}: destructive actions must be prohibited`);
  }

  if (examplePath.includes('event-ir')) {
    assert(example.safetyClass === 'synthetic_only', `${examplePath}: example Event-IR must be synthetic_only`);
    assert(example.provenance && typeof example.provenance.hash === 'string', `${examplePath}: Event-IR example must include provenance hash`);
  }

  if (examplePath.includes('identity-ir')) {
    assert(example.safetyMode === 'synthetic_only', `${examplePath}: example Identity-IR must be synthetic_only`);
    assert(Array.isArray(example.primes) && example.primes.length > 0, `${examplePath}: Identity-IR example must include at least one prime`);
  }

  if (examplePath.includes('proof-artifact')) {
    assert(example.safetyMode === 'synthetic_only', `${examplePath}: example proof artifact must be synthetic_only`);
    assert(['SYNTHETIC_ONLY', 'PROVED', 'BOUNDED'].includes(example.status), `${examplePath}: example proof artifact should be synthetic/proved/bounded`);
    assert(example.dynamicMetric && example.configurationVolume && example.archetype, `${examplePath}: proof artifact example must include dynamicMetric, configurationVolume, and archetype`);
  }

  if (examplePath.includes('engagement-policy')) {
    assert(example.defaultMode === 'synthetic_only', `${examplePath}: example engagement policy must default to synthetic_only`);
    assert(example.authority && example.authority.delegationAllowed === false, `${examplePath}: example engagement policy must prohibit delegation`);
    const blocked = (example.blockedActions || []).join('\n');
    assert(blocked.includes('credential_collection'), `${examplePath}: engagement policy must block credential collection`);
    assert(blocked.includes('public_network_scanning'), `${examplePath}: engagement policy must block public network scanning`);
    assert(blocked.includes('payload_execution'), `${examplePath}: engagement policy must block payload execution`);
  }
}

function validateReferenceCatalog(catalogPath, catalog) {
  if (!catalog || !Array.isArray(catalog.references)) return;
  const ids = new Set();
  for (const ref of catalog.references) {
    assert(!ids.has(ref.id), `${catalogPath}: duplicate reference id ${ref.id}`);
    ids.add(ref.id);
    if (ref.safetyClass === 'taxonomy_only' || ref.safetyClass === 'dual_use_restricted') {
      assert(Array.isArray(ref.doNotImport) && ref.doNotImport.length > 0, `${catalogPath}: restricted reference ${ref.id} must declare doNotImport boundaries`);
    }
    if (ref.category === 'adversary_emulation_taxonomy') {
      assert(ref.adoptionMode === 'taxonomy_only' || ref.adoptionMode === 'do_not_import_code', `${catalogPath}: adversary emulation reference ${ref.id} must be taxonomy-only or do-not-import-code`);
    }
  }
}

function validateLsaMap(configPath, config) {
  if (!config || !Array.isArray(config.topics)) return;
  const ids = new Set();
  for (const topic of config.topics) {
    assert(!ids.has(topic.id), `${configPath}: duplicate topic id ${topic.id}`);
    ids.add(topic.id);
  }
  for (let i = 1; i <= 23; i++) {
    assert(ids.has(i), `${configPath}: missing topic id ${i}`);
  }
  for (const edge of config.crossTopicEdges || []) {
    assert(ids.has(edge.from.topic), `${configPath}: crossTopicEdges references unknown from.topic ${edge.from.topic}`);
    assert(ids.has(edge.to.topic), `${configPath}: crossTopicEdges references unknown to.topic ${edge.to.topic}`);
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

for (const file of [...walkJsonFiles('config/schemas'), ...walkJsonFiles('examples'), ...walkJsonFiles('references')]) {
  readJson(file);
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

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
    validate = ajv.compile(schema);
  } catch (err) {
    errors.push(`${schemaPath}: AJV failed to compile schema: ${err.message}`);
    continue;
  }

  if (!validate(example)) {
    errors.push(`${examplePath}: failed ${schemaPath}: ${formatAjvErrors(validate)}`);
  }

  validateSafetyInvariants(examplePath, example);
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
