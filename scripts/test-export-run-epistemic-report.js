#!/usr/bin/env node
'use strict';

/**
 * Tests for export-run-epistemic-report: a run's proofs compose into a validated
 * epistemic-standing report artifact, and the CLI writes json + md into the run.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const { buildReport, idTail } = require('./export-run-epistemic-report');

const ROOT = path.resolve(__dirname, '..');
const FIXED_TS = '2026-07-31T00:00:00.000Z';

function fail(message) {
  console.error(`export-run-epistemic-report test FAILED:\n${message}`);
  process.exit(1);
}
function assert(cond, message) {
  if (!cond) fail(message);
}

function proof(id, level) {
  return {
    proofId: `proof-${id}`,
    claim: { claimId: `claim.${id}`, claimType: 'scope_bound', statement: id, epistemicLevel: level },
  };
}

function main() {
  // buildReport composes to the weakest and validates against the schema.
  const report = buildReport(
    [proof('a', 'proved'), proof('b', 'empirical'), proof('c', 'synthetic')],
    { runId: 'scope-d-run-2026-07-31', generatedAt: FIXED_TS },
  );
  assert(report.composedEpistemicStanding === 'synthetic', 'should compose to weakest (synthetic)');
  assert(report.reportId === 'run-epistemic-report:scope-d-run-2026-07-31', `bad reportId: ${report.reportId}`);
  assert(report.proofCount === 3, 'proofCount');
  assert(report.schemaVersion === '0.1.0', 'schemaVersion');

  // A rejected claim absorbs.
  const rejected = buildReport([proof('a', 'proved'), proof('b', 'rejected')], {
    runId: 'r2',
    generatedAt: FIXED_TS,
  });
  assert(rejected.composedEpistemicStanding === 'rejected', 'rejected must absorb');

  // reportId sanitization for messy run ids.
  assert(idTail('Run/With SPACES!') === 'run-with-spaces-', `idTail sanitization: ${idTail('Run/With SPACES!')}`);

  // End-to-end: write a run dir, invoke the CLI, check artifacts.
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-run-'));
  try {
    fs.writeFileSync(
      path.join(runDir, 'proof-artifact.json'),
      JSON.stringify([proof('a', 'empirical'), proof('b', 'bounded')]),
    );
    childProcess.execFileSync(
      process.execPath,
      [
        path.join(ROOT, 'scripts/export-run-epistemic-report.js'),
        runDir,
        '--run-id',
        'e2e-run',
        '--generated-at',
        FIXED_TS,
      ],
      { stdio: 'pipe' },
    );
    const out = JSON.parse(fs.readFileSync(path.join(runDir, 'run-epistemic-report.json'), 'utf8'));
    assert(out.composedEpistemicStanding === 'empirical', 'e2e: empirical ∧ bounded = empirical');
    assert(fs.existsSync(path.join(runDir, 'run-epistemic-report.md')), 'markdown report should be written');
  } finally {
    fs.rmSync(runDir, { recursive: true, force: true });
  }

  console.log('export-run-epistemic-report tests passed.');
}

main();
