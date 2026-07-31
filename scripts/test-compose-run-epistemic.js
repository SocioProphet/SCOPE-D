#!/usr/bin/env node
'use strict';

/**
 * Tests for compose-run-epistemic: folding a bundle of proof artifacts into an
 * overall epistemic standing. Uses proof-artifact-shaped fixtures inline (the
 * `claim.epistemicLevel` path matches proof-artifact.schema.json).
 */

const { composeProofEpistemic, levelsFromProofs } = require('./compose-run-epistemic');

function fail(message) {
  console.error(`compose-run-epistemic test FAILED:\n${message}`);
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
  // All empirical → empirical.
  assert(
    composeProofEpistemic([proof('a', 'empirical'), proof('b', 'empirical')])
      .composedEpistemicStanding === 'empirical',
    'uniform empirical proofs should compose to empirical',
  );

  // Mixed → weakest (degrade).
  assert(
    composeProofEpistemic([
      proof('a', 'proved'),
      proof('b', 'empirical'),
      proof('c', 'synthetic'),
    ]).composedEpistemicStanding === 'synthetic',
    'composition should degrade to the weakest claim',
  );

  // A rejected claim is absorbing.
  const rejected = composeProofEpistemic([
    proof('a', 'proved'),
    proof('b', 'bounded'),
    proof('c', 'rejected'),
  ]);
  assert(
    rejected.composedEpistemicStanding === 'rejected',
    'a rejected proof must absorb the composition',
  );

  // No proofs → vacuously proved (the top).
  assert(
    composeProofEpistemic([]).composedEpistemicStanding === 'proved',
    'an empty bundle should compose to the vacuous top (proved)',
  );

  // Proofs missing an epistemicLevel are skipped, not fatal.
  const withGap = composeProofEpistemic([
    proof('a', 'empirical'),
    { proofId: 'proof-x', claim: { statement: 'no level here' } },
    proof('b', 'bounded'),
  ]);
  assert(
    withGap.levelsConsidered.length === 2 &&
      withGap.composedEpistemicStanding === 'empirical',
    'proofs without an epistemicLevel should be skipped',
  );

  // levelsFromProofs is direct and order-preserving.
  assert(
    JSON.stringify(levelsFromProofs([proof('a', 'bounded'), proof('b', 'synthetic')])) ===
      JSON.stringify(['bounded', 'synthetic']),
    'levelsFromProofs should extract levels in order',
  );

  console.log('compose-run-epistemic tests passed.');
}

main();
