#!/usr/bin/env node
'use strict';

/**
 * Composable epistemic lattice for SCOPE-D.
 *
 * SCOPE-D's proof artifacts carry an `epistemicLevel` label (see
 * config/schemas/proof-artifact.schema.json), but until now nothing could
 * *compose* two of them and defend the result. This module supplies that
 * algebra, and is a deliberate, byte-for-byte port of the canonical definition
 * in the estate's `prophet-truth` crate
 * (github.com/SocioProphet/prophet-truth). The two must agree so that a level
 * composed here means exactly what it means anywhere else in the estate.
 *
 * Two rules are load-bearing:
 *
 *   1. Composition uses MEET (the greatest lower bound), never JOIN. An assembly
 *      is no more certain than its weakest input — composition degrades, never
 *      upgrades. `join` is provided for completeness but must never be used to
 *      combine the inputs of a composition.
 *
 *   2. `rejected` is an ABSORBING bottom: meet(rejected, x) === rejected for
 *      every x. It does not merely mean "least certain"; it marks a claim known
 *      false or disallowed, and anything built on it inherits that status
 *      unconditionally. This is encoded explicitly below, not left to fall out
 *      of the ordinal comparison, so a future reordering cannot break it.
 */

// Bottom → top, matching prophet-truth's EpistemicLevel discriminants.
const ORDER = Object.freeze([
  'rejected',
  'speculative',
  'synthetic',
  'empirical',
  'bounded',
  'proved',
]);

const RANK = Object.freeze(
  ORDER.reduce((acc, level, i) => {
    acc[level] = i;
    return acc;
  }, {}),
);

const REJECTED = 'rejected'; // absorbing bottom
const PROVED = 'proved'; // top (meet identity)

function isLevel(x) {
  return typeof x === 'string' && Object.prototype.hasOwnProperty.call(RANK, x);
}

function requireLevel(x) {
  if (!isLevel(x)) {
    throw new TypeError(`unknown epistemic level: ${JSON.stringify(x)}`);
  }
  return x;
}

/**
 * Greatest lower bound. THIS is the composition operator. `rejected` is handled
 * first and explicitly (absorbing bottom); only then do we fall back to the
 * ordinal minimum.
 */
function meet(a, b) {
  requireLevel(a);
  requireLevel(b);
  if (a === REJECTED || b === REJECTED) {
    return REJECTED;
  }
  return RANK[a] <= RANK[b] ? a : b;
}

/**
 * Least upper bound. Provided for lattice completeness and for reasoning about
 * alternatives (either branch would do). NEVER use it to combine the inputs of
 * a composition — that is what `meet` is for, and using `join` there would let
 * an assembly claim more certainty than its weakest part.
 */
function join(a, b) {
  requireLevel(a);
  requireLevel(b);
  return RANK[a] >= RANK[b] ? a : b;
}

/**
 * Fold `meet` over a list of levels: the composed epistemic standing of an
 * assembly of claims. The identity is `proved` (the top), so composing nothing
 * is vacuously `proved` and composing one level returns it unchanged.
 */
function compose(levels) {
  if (!Array.isArray(levels)) {
    throw new TypeError('compose expects an array of epistemic levels');
  }
  return levels.reduce((acc, level) => meet(acc, level), PROVED);
}

module.exports = {
  ORDER,
  RANK,
  REJECTED,
  PROVED,
  isLevel,
  meet,
  join,
  compose,
};
