#!/usr/bin/env node
'use strict';

/**
 * test-wargames-commander-dashboard.js
 *
 * Calls the commander dashboard export script, validates the output hits all required fields,
 * and asserts executionPerformed === false.
 * Exit 0 on success.
 */

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(ROOT, 'config/schemas/wargames-commander-dashboard.schema.json');
const OUT_PATH = path.join(ROOT, 'wargames-commander-dashboard.test-output.json');
const EXPORT_SCRIPT = path.join(ROOT, 'scripts/export-wargames-commander-dashboard.js');

const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}

function createAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

// Run the export script to produce the dashboard output
try {
  childProcess.execFileSync(process.execPath, [EXPORT_SCRIPT, '--out', OUT_PATH], {
    cwd: ROOT,
    stdio: 'pipe',
  });
} catch (err) {
  console.error('export-wargames-commander-dashboard.js failed to run:');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}

// Load and validate output
let dashboard;
try {
  dashboard = readJson(OUT_PATH);
} catch (err) {
  console.error(`Failed to read output file ${OUT_PATH}: ${err.message}`);
  process.exit(1);
}

// 1. Validate against schema
const schema = readJson(SCHEMA_PATH);
const ajv = createAjv();
const validate = ajv.compile(schema);
if (!validate(dashboard)) {
  const details = (validate.errors || [])
    .map((err) => `${err.instancePath || '/'} ${err.message}`)
    .join('; ');
  errors.push(`Schema validation failed: ${details}`);
}

// 2. Assert executionPerformed === false (critical invariant)
assert(dashboard.executionPerformed === false, 'executionPerformed must be false');

// 3. Assert all required top-level fields are present
const REQUIRED_FIELDS = [
  'schemaVersion', 'dashboardId', 'generatedAt', 'sourceRunRefs',
  'wargamesMode', 'surfaceCoverage', 'phaseState', 'agentStatus',
  'proofStatus', 'boundaryEventFindings', 'tliRwi', 'engagementLadderState',
  'michaelApprovalStatus', 'lsaTopicCoverage', 'ontologyValidation',
  'ofifReadiness', 'executionPerformed',
];
for (const field of REQUIRED_FIELDS) {
  assert(Object.prototype.hasOwnProperty.call(dashboard, field), `Missing required field: ${field}`);
}

// 4. Assert schemaVersion
assert(dashboard.schemaVersion === '0.1.0', `schemaVersion must be "0.1.0", got "${dashboard.schemaVersion}"`);

// 5. Assert dashboardId pattern
assert(
  typeof dashboard.dashboardId === 'string' && /^wargames-dashboard:[a-z0-9][a-z0-9._:-]*$/.test(dashboard.dashboardId),
  `dashboardId does not match required pattern: ${dashboard.dashboardId}`
);

// 6. Assert sourceRunRefs has at least one entry
assert(
  Array.isArray(dashboard.sourceRunRefs) && dashboard.sourceRunRefs.length >= 1,
  'sourceRunRefs must have at least 1 entry'
);

// 7. Assert wargamesMode fields
assert(
  dashboard.wargamesMode && ['DEFENSE', 'LEARNING', 'UNSET'].includes(dashboard.wargamesMode.mode),
  `wargamesMode.mode must be DEFENSE/LEARNING/UNSET, got "${dashboard.wargamesMode && dashboard.wargamesMode.mode}"`
);
assert(
  typeof dashboard.wargamesMode.bridgeModeEligible === 'boolean',
  'wargamesMode.bridgeModeEligible must be boolean'
);

// 8. Assert lsaTopicCoverage.totalTopics === 23
assert(
  dashboard.lsaTopicCoverage && dashboard.lsaTopicCoverage.totalTopics === 23,
  `lsaTopicCoverage.totalTopics must be 23, got ${dashboard.lsaTopicCoverage && dashboard.lsaTopicCoverage.totalTopics}`
);

// 9. Assert TLI and RWI are in [0,1]
assert(
  dashboard.tliRwi && typeof dashboard.tliRwi.tli === 'number' &&
  dashboard.tliRwi.tli >= 0 && dashboard.tliRwi.tli <= 1,
  `tliRwi.tli must be a number in [0,1], got ${dashboard.tliRwi && dashboard.tliRwi.tli}`
);
assert(
  dashboard.tliRwi && typeof dashboard.tliRwi.rwi === 'number' &&
  dashboard.tliRwi.rwi >= 0 && dashboard.tliRwi.rwi <= 1,
  `tliRwi.rwi must be a number in [0,1], got ${dashboard.tliRwi && dashboard.tliRwi.rwi}`
);

// 10. Assert engagementLadderState
assert(
  dashboard.engagementLadderState &&
  ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'].includes(dashboard.engagementLadderState.currentLevel),
  `engagementLadderState.currentLevel must be E1-E6`
);
assert(
  dashboard.engagementLadderState &&
  ['none', 'proposed', 'approved', 'denied', 'expired'].includes(dashboard.engagementLadderState.approvalStatus),
  `engagementLadderState.approvalStatus must be a valid enum value`
);

// 11. Assert michaelApprovalStatus
assert(
  dashboard.michaelApprovalStatus &&
  typeof dashboard.michaelApprovalStatus.required === 'boolean',
  'michaelApprovalStatus.required must be boolean'
);
assert(
  dashboard.michaelApprovalStatus &&
  Array.isArray(dashboard.michaelApprovalStatus.approvedActions),
  'michaelApprovalStatus.approvedActions must be an array'
);

// 12. Assert ontologyValidation
assert(
  dashboard.ontologyValidation &&
  ['validated', 'pending', 'failed', 'skipped'].includes(dashboard.ontologyValidation.status),
  `ontologyValidation.status must be a valid enum value`
);

// 13. Assert ofifReadiness
assert(
  dashboard.ofifReadiness &&
  typeof dashboard.ofifReadiness.clientOutputsReady === 'boolean',
  'ofifReadiness.clientOutputsReady must be boolean'
);

// 14. Assert proofStatus structure
assert(
  dashboard.proofStatus &&
  typeof dashboard.proofStatus.totalProofs === 'number' &&
  typeof dashboard.proofStatus.verifiedProofs === 'number' &&
  typeof dashboard.proofStatus.pendingProofs === 'number',
  'proofStatus must have integer totalProofs, verifiedProofs, pendingProofs'
);

// 15. Assert agentStatus is an array
assert(Array.isArray(dashboard.agentStatus), 'agentStatus must be an array');

// Clean up temp output
try { fs.unlinkSync(OUT_PATH); } catch (_) {}

// Report
if (errors.length > 0) {
  console.error('Wargames commander dashboard tests FAILED:');
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log('Wargames commander dashboard tests passed.');
