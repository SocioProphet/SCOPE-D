#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_ATOMIC = 'examples/scope-d/atomic-testcase.example.json';
const DEFAULT_OUT = 'runs/synthetic-lab/events.jsonl';

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
}

function ensureSafeAtomic(atomic, sourcePath) {
  const errors = [];
  const safety = atomic.safety || {};
  const executor = atomic.executor || {};

  if (safety.blockedInProduction !== true) errors.push('blockedInProduction must be true');
  if (!Array.isArray(safety.allowedModes) || safety.allowedModes.includes('live_execution')) errors.push('live_execution must not be allowed');
  if (executor.type !== 'synthetic_event') errors.push('executor.type must be synthetic_event');
  if (executor.command !== null) errors.push('executor.command must be null for synthetic generation');

  if (errors.length > 0) {
    console.error(`Refusing to generate event from unsafe atomic testcase ${sourcePath}:`);
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }
}

function main() {
  const atomicPath = process.argv[2] || DEFAULT_ATOMIC;
  const outPath = process.argv[3] || DEFAULT_OUT;
  const atomic = readJson(atomicPath);
  ensureSafeAtomic(atomic, atomicPath);

  const now = new Date().toISOString();
  const telemetry = Array.isArray(atomic.expectedTelemetry) ? atomic.expectedTelemetry : [];
  const base = telemetry[0] || { source: 'scope-d.synthetic', eventName: 'SyntheticEvent', fields: {} };

  const event = {
    schemaVersion: '0.1.0',
    eventType: 'scope_d.synthetic_atomic_observation',
    generatedAt: now,
    atomicTestId: atomic.id,
    atomicTestName: atomic.name,
    source: base.source || 'scope-d.synthetic',
    eventName: base.eventName || 'SyntheticEvent',
    fields: base.fields || {},
    safety: {
      mode: 'synthetic_event',
      blockedInProduction: true,
      liveExecution: false
    },
    expectedDetections: atomic.expectedDetections || []
  };

  const outAbs = path.join(ROOT, outPath);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.appendFileSync(outAbs, `${JSON.stringify(event)}\n`, 'utf8');
  console.log(`Wrote synthetic event: ${outPath}`);
}

main();
