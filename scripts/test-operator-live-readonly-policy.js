#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(ROOT, 'config', 'schemas', 'operator-live-readonly-policy.schema.json');
const VALID_PATH = path.join(ROOT, 'examples', 'scope-d', 'operator-live-readonly-policy.example.json');
const INVALID_TOOL_CALL = path.join(ROOT, 'fixtures', 'invalid', 'operator-live-readonly-policy-allows-tool-call.invalid.json');
const INVALID_AUDIT = path.join(ROOT, 'fixtures', 'invalid', 'operator-live-readonly-policy-missing-audit.invalid.json');

const REQUIRED_BLOCKS = [
  'mcp_tool_call',
  'arbitrary_json_rpc',
  'model_prompt_execution',
  'kubectl_exec',
  'cluster_mutation',
  'deployment',
  'credential_access',
  'external_scan',
  'policy_mutation',
  'repository_mutation',
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validateSchema(value, label) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(readJson(SCHEMA_PATH));
  if (!validate(value)) {
    const details = (validate.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
    fail(`${label} failed schema validation: ${details}`);
  }
}

function semanticErrors(policy) {
  const errors = [];
  for (const block of REQUIRED_BLOCKS) {
    if (!policy.blockedMethods.includes(block)) errors.push(`missing blocked method ${block}`);
  }
  if (policy.executionAllowed !== false) errors.push('executionAllowed must be false');
  if (!policy.auditRequired || policy.auditRequired.emitRunIndex !== true) errors.push('emitRunIndex must be true');
  if (!Array.isArray(policy.nonClaims) || !policy.nonClaims.some((claim) => claim.toLowerCase().includes('does not authorize'))) {
    errors.push('nonClaims must explicitly constrain authorization');
  }
  return errors;
}

function expectValid(file, label) {
  const policy = readJson(file);
  validateSchema(policy, label);
  const errors = semanticErrors(policy);
  if (errors.length > 0) fail(`${label} semantic validation failed: ${errors.join('; ')}`);
}

function expectInvalid(file, label, expectedFragment) {
  const policy = readJson(file);
  validateSchema(policy, label);
  const errors = semanticErrors(policy);
  if (errors.length === 0) fail(`${label} unexpectedly passed semantic validation.`);
  if (!errors.some((error) => error.includes(expectedFragment))) {
    fail(`${label} did not include expected error fragment "${expectedFragment}"; got ${errors.join('; ')}`);
  }
}

expectValid(VALID_PATH, 'valid live read-only policy');
expectInvalid(INVALID_TOOL_CALL, 'invalid tool-call policy', 'mcp_tool_call');
expectInvalid(INVALID_AUDIT, 'invalid audit policy', 'emitRunIndex');

console.log('Operator live read-only policy tests passed.');
