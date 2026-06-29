#!/usr/bin/env node
'use strict';

/**
 * test-wargames-ofif-export.js
 *
 * Tests the export-wargames-ofif.js adapter script:
 *   - Finds an existing run with a run-summary.json in runs/
 *   - Calls the export script against it
 *   - Validates the output is a valid OrionObservationEvent (checks required fields)
 *   - Exit 0 on success, non-zero on failure
 */

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPORT_SCRIPT = path.join(ROOT, 'scripts', 'export-wargames-ofif.js');
const RUNS_DIR = path.join(ROOT, 'runs');

const REQUIRED_OBSERVATION_EVENT_FIELDS = [
  'schema_version',
  'event_id',
  'event_type',
  'title',
  'summary',
  'observed_at',
  'location',
  'severity',
  'confidence',
  'source_record_refs',
  'evidence_grade',
  'policy_state',
];

const REQUIRED_ADAPTER_META_FIELDS = [
  'redactionState',
  'disclosureClass',
  'policyRef',
  'executionPerformed',
];

function fail(message, result) {
  console.error(`[test-wargames-ofif-export] FAIL: ${message}`);
  if (result && result.stderr) console.error(result.stderr);
  process.exit(1);
}

function parseJson(text, label, result) {
  try {
    return JSON.parse(text);
  } catch (err) {
    fail(`${label}: expected JSON output — ${err.message}`, result);
  }
}

// Find a run directory that has a run-summary.json
function findRunDir() {
  if (!fs.existsSync(RUNS_DIR)) {
    fail(`runs/ directory not found at ${RUNS_DIR}`);
  }
  const entries = fs.readdirSync(RUNS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const summaryPath = path.join(RUNS_DIR, entry.name, 'run-summary.json');
    if (fs.existsSync(summaryPath)) {
      return path.join(RUNS_DIR, entry.name);
    }
  }
  fail('No run directory with run-summary.json found in runs/');
}

const runDir = findRunDir();
console.log(`[test-wargames-ofif-export] Using run dir: ${runDir}`);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-wargames-ofif-'));
const outFile = path.join(tmpDir, 'wargames-ofif-output.json');

// Run the export script
const result = cp.spawnSync(
  process.execPath,
  [EXPORT_SCRIPT, runDir, '--out', outFile],
  { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }
);

if (result.status !== 0) {
  fail(`export-wargames-ofif.js exited with status ${result.status}`, result);
}

if (!fs.existsSync(outFile)) {
  fail(`Expected output file not written: ${outFile}`);
}

const raw = fs.readFileSync(outFile, 'utf8');
const envelope = parseJson(raw, 'wargames-ofif output');

// Validate adapter envelope wrapper
if (!envelope._adapterMeta) {
  fail('Output missing _adapterMeta wrapper');
}
if (!envelope.orionObservationEvent) {
  fail('Output missing orionObservationEvent');
}

const meta = envelope._adapterMeta;
for (const field of REQUIRED_ADAPTER_META_FIELDS) {
  if (meta[field] === undefined) {
    fail(`_adapterMeta missing required field: ${field}`);
  }
}

// Invariant: executionPerformed must always be false
if (meta.executionPerformed !== false) {
  fail(`executionPerformed must be false, got: ${meta.executionPerformed}`);
}

// Invariant: redactionState must be "synthetic" for wargames outputs
if (meta.redactionState !== 'synthetic') {
  fail(`redactionState must be "synthetic", got: ${meta.redactionState}`);
}

// Invariant: disclosureClass must be "internal" (default until OFIF client access envelope approved)
if (meta.disclosureClass !== 'internal') {
  fail(`disclosureClass must be "internal", got: ${meta.disclosureClass}`);
}

// Validate OrionObservationEvent required fields
const evt = envelope.orionObservationEvent;
for (const field of REQUIRED_OBSERVATION_EVENT_FIELDS) {
  if (evt[field] === undefined) {
    fail(`orionObservationEvent missing required field: ${field}`);
  }
}

// Validate event_id pattern: ^orion-evt-[a-z0-9][a-z0-9._-]*$
if (!/^orion-evt-[a-z0-9][a-z0-9._-]*$/.test(evt.event_id)) {
  fail(`event_id does not match Orion pattern: ${evt.event_id}`);
}

// Validate location is GeoJSON Point
if (!evt.location || evt.location.type !== 'Point' || !Array.isArray(evt.location.coordinates)) {
  fail('location must be a GeoJSON Point with coordinates array');
}

// Validate source_record_refs is non-empty
if (!Array.isArray(evt.source_record_refs) || evt.source_record_refs.length === 0) {
  fail('source_record_refs must be a non-empty array');
}

// Validate evidence_grade is fixture.synthetic for wargames
if (evt.evidence_grade !== 'fixture.synthetic') {
  fail(`evidence_grade must be "fixture.synthetic" for wargames, got: ${evt.evidence_grade}`);
}

// Cleanup
try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch (_) {
  // best-effort
}

console.log(
  `[test-wargames-ofif-export] PASS — OrionObservationEvent validated: ` +
  `event_id=${evt.event_id} event_type=${evt.event_type} ` +
  `redactionState=${meta.redactionState} executionPerformed=${meta.executionPerformed}`
);
