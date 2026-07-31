#!/usr/bin/env node
'use strict';

/**
 * Export a run's epistemic standing as a validated report artifact.
 *
 * Reads a run's `proof-artifact.json`, composes every claim's `epistemicLevel`
 * with the composable lattice (meet; `rejected` absorbing) and writes
 * `run-epistemic-report.json` + `.md` into the run directory. The standing of
 * the whole run is no stronger than its weakest proven claim.
 *
 * This is an **additive** report: it reads the run's proofs and writes new
 * artifacts, without touching run-summary.json or any existing schema.
 *
 * Usage:
 *   node scripts/export-run-epistemic-report.js <run-dir> \
 *        [--out-dir <dir>] [--run-id <id>] [--generated-at <iso8601>]
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const { composeProofEpistemic, loadProofArtifacts } = require('./compose-run-epistemic');

const ROOT = path.resolve(__dirname, '..');
const REPORT_SCHEMA = 'config/schemas/run-epistemic-report.schema.json';

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function validate(value) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validator = ajv.compile(readJson(REPORT_SCHEMA));
  if (!validator(value)) {
    const details = (validator.errors || [])
      .map((e) => `${e.instancePath || '/'} ${e.message}`)
      .join('; ');
    throw new Error(`run-epistemic-report failed schema validation: ${details}`);
  }
  return value;
}

/** Sanitize an arbitrary run id into the reportId pattern's tail. */
function idTail(runId) {
  const tail = String(runId)
    .toLowerCase()
    .replace(/[^a-z0-9._:-]/g, '-')
    .replace(/^[^a-z0-9]+/, '');
  return tail.length > 0 ? tail : 'run';
}

/** Build (and validate) the report object from a set of proof artifacts. */
function buildReport(proofs, { runId, generatedAt }) {
  const composed = composeProofEpistemic(proofs);
  const report = {
    schemaVersion: '0.1.0',
    reportId: `run-epistemic-report:${idTail(runId)}`,
    runId: String(runId),
    generatedAt,
    proofCount: composed.proofCount,
    levelsConsidered: composed.levelsConsidered,
    composedEpistemicStanding: composed.composedEpistemicStanding,
    rationale:
      `Composed the epistemic standing of ${composed.proofCount} proof artifact(s) ` +
      `as the meet of their claim levels: the run is no stronger than its weakest ` +
      `claim, and a rejected claim is absorbing. Result: ${composed.composedEpistemicStanding}.`,
  };
  return validate(report);
}

function renderMarkdown(report) {
  return [
    `# SCOPE-D Run Epistemic Report: ${report.runId}`,
    '',
    `Generated: ${report.generatedAt}`,
    `Proof artifacts considered: ${report.proofCount}`,
    '',
    '## Composed epistemic standing',
    '',
    `**${report.composedEpistemicStanding}**`,
    '',
    report.rationale,
    '',
    '## Claim levels',
    '',
    ...(report.levelsConsidered.length > 0
      ? report.levelsConsidered.map((l) => `- ${l}`)
      : ['- (none)']),
    '',
  ].join('\n');
}

function parseArgs(argv) {
  const args = { runDir: null, outDir: null, runId: null, generatedAt: null };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--out-dir') { args.outDir = argv[++i]; continue; }
    if (item === '--run-id') { args.runId = argv[++i]; continue; }
    if (item === '--generated-at') { args.generatedAt = argv[++i]; continue; }
    if (!args.runDir) { args.runDir = item; }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.runDir) {
    console.error(
      'Usage: node scripts/export-run-epistemic-report.js <run-dir> [--out-dir <dir>] [--run-id <id>] [--generated-at <iso8601>]',
    );
    process.exit(2);
  }
  const proofs = loadProofArtifacts(args.runDir);
  const runId = args.runId || path.basename(path.resolve(args.runDir));
  const generatedAt = args.generatedAt || new Date().toISOString();
  const report = buildReport(proofs, { runId, generatedAt });

  const outDir = args.outDir || args.runDir;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'run-epistemic-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(outDir, 'run-epistemic-report.md'),
    renderMarkdown(report),
    'utf8',
  );
  console.log(
    `run-epistemic-report: ${report.composedEpistemicStanding} (${report.proofCount} proof(s)) → ${outDir}`,
  );
}

module.exports = { buildReport, renderMarkdown, idTail };

if (require.main === module) {
  main();
}
