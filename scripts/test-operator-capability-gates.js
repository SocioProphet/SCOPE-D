#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA = path.join(ROOT, 'config', 'schemas', 'operator-capability-gate.schema.json');
const VALID = path.join(ROOT, 'examples', 'scope-d', 'operator-capability-gate.live-readonly.example.json');
const INVALID = path.join(ROOT, 'fixtures', 'invalid', 'operator-capability-gate-high-risk-enabled.invalid.json');
const HIGH_RISK_CLASSES = ['credential_access', 'payload_delivery', 'mutation', 'destructive_behavior'];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function schemaErrors(value) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(readJson(SCHEMA));
  if (validate(value)) return [];
  return (validate.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`);
}

function semanticErrors(gate) {
  const errors = [];
  const capabilities = new Set(gate.capabilityClasses || []);
  const blocked = new Set(gate.blockedClasses || []);
  const allowedModes = new Set(gate.allowedModes || []);

  for (const required of ['targetScope', 'rateLimit', 'decisionReceipt', 'planReceipt', 'resultReceipt']) {
    if (!gate.controlsRequired || gate.controlsRequired[required] !== true) errors.push(`${required} control must be required`);
  }

  for (const highRisk of HIGH_RISK_CLASSES) {
    if (!blocked.has(highRisk)) errors.push(`${highRisk} must be blocked`);
  }

  if (gate.executionEnabled === true) {
    for (const highRisk of HIGH_RISK_CLASSES) {
      if (capabilities.has(highRisk)) errors.push(`${highRisk} cannot be execution-enabled in this tranche`);
    }
  }

  if (allowedModes.has('live_readonly') && !capabilities.has('network_access')) {
    errors.push('live_readonly mode requires network_access capability class');
  }

  if (!Array.isArray(gate.nonClaims) || !gate.nonClaims.some((claim) => claim.includes('does not authorize'))) {
    errors.push('nonClaims must explicitly bound authorization');
  }

  return errors;
}

function expectValid(file, label) {
  const value = readJson(file);
  const schema = schemaErrors(value);
  if (schema.length > 0) fail(`${label} failed schema validation: ${schema.join('; ')}`);
  const semantic = semanticErrors(value);
  if (semantic.length > 0) fail(`${label} failed semantic validation: ${semantic.join('; ')}`);
}

function expectInvalid(file, label, expectedFragment) {
  const value = readJson(file);
  const errors = [...schemaErrors(value), ...semanticErrors(value)];
  if (errors.length === 0) fail(`${label} unexpectedly passed validation.`);
  if (!errors.some((error) => error.includes(expectedFragment))) {
    fail(`${label} did not contain expected fragment ${expectedFragment}; got ${errors.join('; ')}`);
  }
}

expectValid(VALID, 'valid capability gate');
expectInvalid(INVALID, 'invalid high-risk capability gate', 'credential_access');

console.log('Operator capability gate tests passed.');
