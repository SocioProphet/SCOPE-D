#!/usr/bin/env node
'use strict';

/**
 * export-wargames-ofif.js
 *
 * Reads a SCOPE-D wargames run summary and emits an OrionObservationEvent-shaped
 * JSON suitable for Orion Field Intelligence (OFIF) consumption.
 *
 * Usage:
 *   node scripts/export-wargames-ofif.js <run-dir> [--out <output.json>]
 *
 * Invariants:
 *   - executionPerformed is always false
 *   - redactionState is always "synthetic" for wargames outputs
 *   - disclosureClass defaults to "internal" until an OFIF client access envelope is approved
 */

const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error(`[export-wargames-ofif] ERROR: ${msg}`);
  process.exit(1);
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function addDays(isoDate, days) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// Parse CLI args
const args = process.argv.slice(2);
if (args.length === 0) {
  fail('Usage: node scripts/export-wargames-ofif.js <run-dir> [--out <output.json>]');
}

const runDir = path.resolve(args[0]);
let outPath = null;
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--out' && args[i + 1]) {
    outPath = path.resolve(args[i + 1]);
    i++;
  }
}

if (!fs.existsSync(runDir) || !fs.statSync(runDir).isDirectory()) {
  fail(`Run directory does not exist or is not a directory: ${runDir}`);
}

const summaryPath = path.join(runDir, 'run-summary.json');
if (!fs.existsSync(summaryPath)) {
  fail(`No run-summary.json found in: ${runDir}`);
}

let summary;
try {
  summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
} catch (err) {
  fail(`Failed to parse run-summary.json: ${err.message}`);
}

// Derive fields
const runId = summary.runId || path.basename(runDir);
const generatedAt = summary.generatedAt || new Date().toISOString();
const validUntil = addDays(generatedAt, 30);

// Determine mode from safety or target fields (defensive vs learning)
const mode = (summary.mode && summary.mode.toUpperCase() === 'LEARNING') ? 'learning' : 'defensive';
const eventTypeSuffix = mode === 'learning' ? 'learning_run' : 'defensive_run';

// event_id must match ^orion-evt-[a-z0-9][a-z0-9._-]*$
const sluggedRunId = slugify(runId);
const eventId = `orion-evt-wargames-${sluggedRunId}`;

// title
const title = `SCOPE-D Wargames Run — ${runId}`;

// summary text: use description or first artifact note
let summaryText = '';
if (summary.handoff && summary.handoff.notes && summary.handoff.notes.length > 0) {
  summaryText = summary.handoff.notes[0];
} else {
  summaryText = `Synthetic wargames ${mode} run from SCOPE-D. Run ID: ${runId}. No live execution performed.`;
}

// proofRefs from receipt if present
const proofRefs = [];
if (summary.receipt && summary.receipt.receiptId) {
  proofRefs.push(`scope-d-receipt:${summary.receipt.receiptId}`);
}
if (summary.handoff && summary.handoff.proofRefs) {
  proofRefs.push(...summary.handoff.proofRefs);
}

// source_record_refs: required by schema, min 1; use run receipt id as the gaia-src ref
const sourceRecordRef = `gaia-src-wargames-${sluggedRunId}`;

// Build OrionObservationEvent
// Note: event_type must be one of the Orion schema enum values.
// Wargames runs are virtual synthetic events — "unknown" is the correct
// schema-valid mapping until the Orion schema adds a wargames event type.
const orionObservationEvent = {
  schema_version: '0.1.0',
  event_id: eventId,
  event_type: 'unknown',
  title,
  summary: summaryText,
  observed_at: generatedAt,
  valid_until: validUntil,
  location: {
    type: 'Point',
    coordinates: [0, 0]
  },
  severity: 'info',
  confidence: 1.0,
  source_record_refs: [sourceRecordRef],
  evidence_grade: 'fixture.synthetic',
  policy_state: 'internal_view_allowed',
  tags: [
    'wargames',
    `wargames.${eventTypeSuffix}`,
    'scope-d',
    'synthetic',
    'no-live-execution'
  ]
};

// Adapter envelope — wraps the Orion event with SCOPE-D governance metadata
const adapterEnvelope = {
  _adapterMeta: {
    adapterVersion: '0.1.0',
    adapterScript: 'scope-d/scripts/export-wargames-ofif.js',
    sourceRunId: runId,
    sourceRunDir: runDir,
    exportedAt: new Date().toISOString(),
    // SCOPE-D governance fields
    eventType: `wargames.${eventTypeSuffix}`,
    redactionState: 'synthetic',
    disclosureClass: 'internal',
    policyRef: 'ofif-policy:wargames-internal',
    executionPerformed: false,
    proofRefs: proofRefs.length > 0 ? proofRefs : undefined
  },
  orionObservationEvent
};

const output = JSON.stringify(adapterEnvelope, null, 2);

if (outPath) {
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outPath, output, 'utf8');
  console.log(`[export-wargames-ofif] Written to: ${outPath}`);
} else {
  process.stdout.write(output + '\n');
}
