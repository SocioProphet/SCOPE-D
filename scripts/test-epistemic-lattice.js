#!/usr/bin/env node
'use strict';

/**
 * Tests for the composable epistemic lattice.
 *
 * Mirrors the test families of the canonical `prophet-truth` crate (lattice
 * laws, absorbing bottom, monotonic degradation) and additionally proves the
 * module's enum is conformant with SCOPE-D's own proof-artifact schema — so a
 * composed level here is the same level the rest of the estate speaks.
 */

const fs = require('fs');
const path = require('path');
const {
  ORDER,
  RANK,
  REJECTED,
  PROVED,
  meet,
  join,
  compose,
} = require('./epistemic-lattice');

const ROOT = path.resolve(__dirname, '..');

function fail(message) {
  console.error(`Epistemic lattice test FAILED:\n${message}`);
  process.exit(1);
}

function assert(cond, message) {
  if (!cond) {
    fail(message);
  }
}

function rankOf(level) {
  return RANK[level];
}

function main() {
  // --- schema conformance: the module's enum matches the CANONICAL schema -----
  // Post-R2 (standards-storage#97) the epistemicLevel enum is no longer
  // copy-pasted into config/schemas/proof-artifact.schema.json; that schema now
  // $refs the estate-canonical ProofArtifact v1. Assert the module against the
  // single source of truth (the sovereign-vendored canonical) directly.
  const canonical = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'vendor/schemas/proof-artifact/proof-artifact.schema.v1.json'),
      'utf8',
    ),
  );
  const schemaEnum =
    canonical.$defs.epistemicLevel.enum.slice().sort();
  const moduleEnum = ORDER.slice().sort();
  assert(
    JSON.stringify(schemaEnum) === JSON.stringify(moduleEnum),
    [
      'epistemicLevel enum drift between module and proof-artifact schema',
      `schema: ${JSON.stringify(schemaEnum)}`,
      `module: ${JSON.stringify(moduleEnum)}`,
    ].join('\n'),
  );
  console.log('Epistemic enum matches proof-artifact schema.');

  // --- lattice laws (exhaustive over all levels) ------------------------------
  for (const a of ORDER) {
    for (const b of ORDER) {
      assert(meet(a, b) === meet(b, a), `meet not commutative: ${a},${b}`);
      assert(join(a, b) === join(b, a), `join not commutative: ${a},${b}`);
      // absorption
      assert(meet(a, join(a, b)) === a, `absorption meet/join: ${a},${b}`);
      assert(join(a, meet(a, b)) === a, `absorption join/meet: ${a},${b}`);
      for (const c of ORDER) {
        assert(
          meet(meet(a, b), c) === meet(a, meet(b, c)),
          `meet not associative: ${a},${b},${c}`,
        );
        assert(
          join(join(a, b), c) === join(a, join(b, c)),
          `join not associative: ${a},${b},${c}`,
        );
      }
    }
    // idempotence and identities
    assert(meet(a, a) === a, `meet not idempotent: ${a}`);
    assert(join(a, a) === a, `join not idempotent: ${a}`);
    assert(meet(a, PROVED) === a, `proved is not the meet identity: ${a}`);
    assert(join(a, REJECTED) === a, `rejected is not the join identity: ${a}`);
  }
  console.log('Lattice laws (commutativity, associativity, idempotence, absorption, identity) hold.');

  // --- absorbing bottom (exhaustive) ------------------------------------------
  for (const x of ORDER) {
    assert(meet(REJECTED, x) === REJECTED, `meet(rejected, ${x}) must be rejected`);
    assert(meet(x, REJECTED) === REJECTED, `meet(${x}, rejected) must be rejected`);
  }
  console.log('rejected is absorbing under meet.');

  // --- monotonic degradation: compose never upgrades --------------------------
  const sample = [
    ['proved', 'empirical', 'speculative'],
    ['bounded', 'bounded'],
    ['proved'],
    [],
    ['empirical', 'rejected', 'proved'],
    ['synthetic', 'bounded', 'empirical'],
  ];
  for (const levels of sample) {
    const composed = compose(levels);
    if (levels.length === 0) {
      assert(composed === PROVED, 'compose([]) should be the top (proved)');
      continue;
    }
    const minRank = Math.min(...levels.map(rankOf));
    assert(
      rankOf(composed) <= minRank,
      `compose(${JSON.stringify(levels)}) = ${composed} exceeded weakest input`,
    );
    if (levels.includes(REJECTED)) {
      assert(
        composed === REJECTED,
        `compose with a rejected input must be rejected: ${JSON.stringify(levels)}`,
      );
    }
  }
  // concrete expected values
  assert(compose(['proved', 'empirical', 'speculative']) === 'speculative',
    'compose downgrades to the weakest');
  assert(compose(['proved', 'bounded', 'rejected']) === 'rejected',
    'a rejected input absorbs the composition');
  console.log('Composition degrades, never upgrades; rejected is absorbing.');

  // --- rejects unknown levels rather than silently coercing -------------------
  let threw = false;
  try {
    meet('proved', 'legendary');
  } catch (err) {
    threw = err instanceof TypeError;
  }
  assert(threw, 'meet must throw on an unknown level, not silently coerce');
  console.log('Unknown levels are rejected.');

  console.log('Epistemic lattice tests passed.');
}

main();
