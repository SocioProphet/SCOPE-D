'use strict';

/**
 * Registers the estate-canonical ProofArtifact schema (standards-storage#97, R2)
 * with an AJV instance so that config/schemas/proof-artifact.schema.json can
 * $ref the canonical `epistemicLevel` enum (and bind to the canonical via allOf)
 * instead of copy-pasting the enum. The canonical is sovereign-vendored under
 * vendor/schemas/proof-artifact/ so this resolves fully offline.
 */

const fs = require('fs');
const path = require('path');

const CANONICAL_ID = 'https://schemas.socioprophet.ai/proof-artifact/v1.json';
const CANONICAL_REL = path.join(
  'vendor',
  'schemas',
  'proof-artifact',
  'proof-artifact.schema.v1.json',
);
const CANONICAL_ABS = path.resolve(__dirname, '..', '..', CANONICAL_REL);

let cachedCanonical = null;

function loadCanonicalProofArtifact() {
  if (!cachedCanonical) {
    cachedCanonical = JSON.parse(fs.readFileSync(CANONICAL_ABS, 'utf8'));
  }
  return cachedCanonical;
}

function registerCanonicalProofArtifact(ajv) {
  if (!ajv.getSchema(CANONICAL_ID)) {
    ajv.addSchema(loadCanonicalProofArtifact());
  }
  return ajv;
}

module.exports = {
  CANONICAL_ID,
  CANONICAL_REL,
  loadCanonicalProofArtifact,
  registerCanonicalProofArtifact,
};
