#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = 'config/schemas/collector-policy.schema.json';
const VALID_FIXTURE = 'examples/scope-d/collector-policy.example.json';

const INVALID_FIXTURES = [
  {
    label: 'unknown collector type',
    path: 'fixtures/invalid/collector-policy-unknown-type.invalid.json',
    expectedPath: '/collectorRegistration/collectorType',
  },
  {
    label: 'wildcard filesystem path',
    path: 'fixtures/invalid/collector-policy-wildcard-path.invalid.json',
    expectedPath: '/allowedReadOnlyScopes/filesystemPaths/0',
  },
  {
    label: 'execution allowed',
    path: 'fixtures/invalid/collector-policy-execution-allowed.invalid.json',
    expectedPath: '/executionGuarantee/canExecuteCommands',
  },
  {
    label: 'network egress allowed',
    path: 'fixtures/invalid/collector-policy-network-egress.invalid.json',
    expectedPath: '/networkBoundary/egressMode',
  },
];

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
}

function createValidator() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = readJson(SCHEMA_PATH);
  return ajv.compile(schema);
}

function formatErrors(validate) {
  return (validate.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertValidPolicyInvariants(policy) {
  assert(policy.capabilityBoundary.prohibited.includes('exec'), 'Valid collector policy must prohibit exec.');
  assert(policy.capabilityBoundary.prohibited.includes('network_egress'), 'Valid collector policy must prohibit network_egress.');
  assert(policy.capabilityBoundary.prohibited.includes('collect_credentials'), 'Valid collector policy must prohibit collect_credentials.');
  assert(policy.executionGuarantee.level === 'none', 'Valid collector policy must declare executionGuarantee.level=none.');
  assert(policy.executionGuarantee.canExecuteCommands === false, 'Valid collector policy must set canExecuteCommands=false.');
  assert(policy.executionGuarantee.canSpawnProcesses === false, 'Valid collector policy must set canSpawnProcesses=false.');
  assert(policy.networkBoundary.egressMode === 'none', 'Valid collector policy must set network egressMode=none.');
  assert(policy.auditTrail.receiptRequired === true, 'Valid collector policy must require receipts.');
  assert(policy.auditTrail.noSilentReads === true, 'Valid collector policy must prohibit silent reads.');
}

function main() {
  const validate = createValidator();

  const validPolicy = readJson(VALID_FIXTURE);
  if (!validate(validPolicy)) {
    fail(`Expected valid collector policy fixture to pass, got: ${formatErrors(validate)}`);
  }
  assertValidPolicyInvariants(validPolicy);

  for (const fixture of INVALID_FIXTURES) {
    const value = readJson(fixture.path);
    const ok = validate(value);
    if (ok) {
      fail(`Expected invalid collector policy fixture to fail: ${fixture.label} (${fixture.path})`);
    }
    const errors = validate.errors || [];
    const paths = errors.map((err) => err.instancePath || '/');
    if (!paths.includes(fixture.expectedPath)) {
      fail([
        `Invalid collector policy fixture failed at unexpected path: ${fixture.label}`,
        `Expected path: ${fixture.expectedPath}`,
        `Actual errors: ${formatErrors(validate)}`,
      ].join('\n'));
    }
    console.log(`Collector policy invalid fixture rejected: ${fixture.label} at ${fixture.expectedPath}`);
  }

  console.log('Collector policy fail-closed tests passed.');
}

main();
