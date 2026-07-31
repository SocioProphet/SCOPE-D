#!/usr/bin/env node
'use strict';

/**
 * Tests for end-to-end epistemic propagation into the client assurance report.
 *
 * report-run.js seeds each run-summary with an `epistemicStanding` (tested by the
 * slice smoke tests, which now assert it). Here we test the client report's
 * consumption side directly: reading a run's standing from its run-summary,
 * falling back to composing from proof artifacts, and folding the assured runs
 * into one client-facing standing via the meet.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const { runEpistemic, composeRuns } = require('./export-client-assurance-report');

const ROOT = path.resolve(__dirname, '..');

/** A validator for the client-assurance-report's epistemicStanding sub-schema,
 * so the code's output shape is checked against the schema it must satisfy. */
function standingValidator() {
  const schema = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'config/schemas/client-assurance-report.schema.json'), 'utf8'),
  );
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile({ $defs: schema.$defs, $ref: '#/$defs/epistemicStanding' });
}

function fail(message) {
  console.error(`epistemic-propagation test FAILED:\n${message}`);
  process.exit(1);
}
function assert(cond, message) {
  if (!cond) fail(message);
}

function proof(id, level) {
  return { proofId: `proof-${id}`, claim: { claimId: `claim.${id}`, claimType: 'scope_bound', statement: id, epistemicLevel: level } };
}

function makeRun(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-prop-run-'));
  for (const [name, value] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), typeof value === 'string' ? value : JSON.stringify(value));
  }
  return dir;
}

function main() {
  const created = [];
  try {
    // Run A: reads standing straight from run-summary.epistemicStanding.
    const runA = makeRun({
      'run-summary.json': { epistemicStanding: { standing: 'empirical', proofCount: 2, levelsConsidered: ['empirical', 'empirical'] } },
    });
    created.push(runA);
    const a = runEpistemic(runA);
    assert(a && a.standing === 'empirical' && a.proofCount === 2, 'run-summary standing path');

    // Run B: no run-summary — falls back to composing from proof artifacts.
    const runB = makeRun({ 'proof-artifact.json': [proof('a', 'bounded'), proof('b', 'synthetic')] });
    created.push(runB);
    const b = runEpistemic(runB);
    assert(b && b.standing === 'synthetic', `proof-fallback path: ${b && b.standing}`);

    // Run C: a rejected run.
    const runC = makeRun({ 'run-summary.json': { epistemicStanding: { standing: 'rejected', proofCount: 1, levelsConsidered: ['rejected'] } } });
    created.push(runC);

    // Fold across runs = the meet.
    const validateStanding = standingValidator();
    const foldAB = composeRuns([runA, runB]);
    assert(foldAB.standing === 'synthetic', `meet(empirical, synthetic) = synthetic, got ${foldAB.standing}`);
    assert(foldAB.runsConsidered === 2 && foldAB.perRun.length === 2, 'runsConsidered/perRun');
    // The produced shape must satisfy the client-report schema.
    assert(
      validateStanding(foldAB),
      `composeRuns output failed schema: ${JSON.stringify(validateStanding.errors)}`,
    );

    // A rejected run is absorbing across the whole report.
    const foldABC = composeRuns([runA, runB, runC]);
    assert(foldABC.standing === 'rejected', 'a rejected run absorbs the client-facing standing');

    // A run with no epistemic evidence is skipped; empty → null.
    const runEmpty = makeRun({ 'note.txt': 'no proofs here' });
    created.push(runEmpty);
    assert(runEpistemic(runEmpty) === null, 'a run with no epistemic evidence yields null');
    assert(composeRuns([runEmpty]) === null, 'no evidence across runs → no standing block');

    console.log('epistemic-propagation tests passed.');
  } finally {
    for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
  }
}

main();
