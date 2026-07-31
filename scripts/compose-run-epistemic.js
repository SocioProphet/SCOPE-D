#!/usr/bin/env node
'use strict';

/**
 * Compose the epistemic standing of a run (or any set of proof artifacts).
 *
 * Each proof artifact carries a `claim.epistemicLevel`. This tool folds them
 * with the composable lattice (scripts/epistemic-lattice.js): the standing of
 * the whole is the MEET of its parts — no stronger than the weakest claim, and
 * `rejected` is absorbing. It answers, for a bundle of proofs, "what can we
 * defensibly claim about all of it at once?"
 *
 * Usage:
 *   node scripts/compose-run-epistemic.js <run-dir | proof-artifact.json>
 */

const fs = require('fs');
const path = require('path');
const { compose, isLevel } = require('./epistemic-lattice');

/** Pull the `claim.epistemicLevel` from each proof, skipping any that lack one. */
function levelsFromProofs(proofs) {
  return proofs
    .map((p) => p && p.claim && p.claim.epistemicLevel)
    .filter((level) => isLevel(level));
}

/** Compose a set of proof artifacts into an overall epistemic standing. */
function composeProofEpistemic(proofs) {
  if (!Array.isArray(proofs)) {
    throw new TypeError('composeProofEpistemic expects an array of proof artifacts');
  }
  const levels = levelsFromProofs(proofs);
  return {
    proofCount: proofs.length,
    levelsConsidered: levels,
    // Vacuously `proved` when there is nothing to weaken it (see lattice module).
    composedEpistemicStanding: compose(levels),
  };
}

/** Load proof artifacts from a run directory or a proof-artifact.json file.
 *
 * Reads directly, without a `stat`-then-read step, to avoid a time-of-check /
 * time-of-use race: try the run directory's `proof-artifact.json` first, then
 * fall back to treating the argument as the file itself. */
function loadProofArtifacts(runOrFile) {
  const candidates = [path.join(runOrFile, 'proof-artifact.json'), runOrFile];
  let lastError;
  for (const file of candidates) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (err) {
      lastError = err;
      continue;
    }
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [data];
  }
  throw lastError;
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      'Usage: node scripts/compose-run-epistemic.js <run-dir | proof-artifact.json>',
    );
    process.exit(2);
  }
  const result = composeProofEpistemic(loadProofArtifacts(arg));
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { levelsFromProofs, composeProofEpistemic, loadProofArtifacts };

if (require.main === module) {
  main();
}
