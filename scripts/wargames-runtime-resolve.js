#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const INVOCATION_SCHEMA = 'config/schemas/wargames-invocation-envelope.schema.json';
const RECEIPT_SCHEMA = 'config/schemas/wargames-runtime-decision-receipt.schema.json';
const MICHAEL_APPROVED_ELEVATED_AUTH = 'engagement-authorization:e6-tabletop-001';

function usage() {
  console.log('Usage: node scripts/wargames-runtime-resolve.js <invocation-envelope.json> [--out <receipt.json>]');
}

function readJson(relOrAbsPath) {
  const absPath = path.isAbsolute(relOrAbsPath) ? relOrAbsPath : path.join(ROOT, relOrAbsPath);
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}

function writeJson(relOrAbsPath, value) {
  const absPath = path.isAbsolute(relOrAbsPath) ? relOrAbsPath : path.join(ROOT, relOrAbsPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function formatAjvErrors(validate) {
  return (validate.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
}

function validateWithSchema(schemaRelPath, value, label) {
  const ajv = createAjv();
  const schema = readJson(schemaRelPath);
  const validate = ajv.compile(schema);
  if (!validate(value)) {
    throw new Error(`${label} failed schema validation: ${formatAjvErrors(validate)}`);
  }
}

function parseArgs(argv) {
  const args = { input: null, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') {
      usage();
      process.exit(0);
    }
    if (item === '--out') {
      args.out = argv[i + 1];
      i += 1;
      continue;
    }
    if (!args.input) {
      args.input = item;
      continue;
    }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.input) throw new Error('Missing invocation-envelope path.');
  return args;
}

function repoFileExists(ref) {
  if (!ref || ref.includes('..')) return false;
  return fs.existsSync(path.join(ROOT, ref));
}

function makeReceipt(invocation, decision, reason, policyRefs = []) {
  return {
    schemaVersion: '0.1.0',
    receiptId: `wargames-runtime-receipt:${invocation.invocationId.replace(/^wargames-invocation:/, '')}`,
    invocationId: invocation.invocationId,
    decision,
    reason,
    contractRefs: invocation.contractRefs || [],
    policyRefs,
    evidenceRefs: invocation.evidenceRefs || [],
    proofRefs: invocation.proofRefs || [],
    authorizationRefs: invocation.authorizationRefs || [],
    redactionState: invocation.redactionState,
    createdAt: new Date().toISOString(),
    liveExecutionPerformed: false,
  };
}

function isElevatedEngagement(invocation) {
  const action = String(invocation.requestedAction || '').toLowerCase();
  return invocation.capabilityClass === 'engage' || /\be[456]\b|e4|e5|e6|engagement_ready/.test(action);
}

function evaluateInvocation(invocation) {
  const policyRefs = ['policy:wargames-runtime-dry-run-v0.1'];

  for (const contractRef of invocation.contractRefs || []) {
    if (!repoFileExists(contractRef)) {
      return makeReceipt(invocation, 'hard_block', `Missing contract reference: ${contractRef}`, policyRefs);
    }
  }

  if (invocation.liveExecutionRequested === true) {
    return makeReceipt(invocation, 'hard_block', 'Live execution was requested. Runtime resolver is dry-run only.', policyRefs);
  }

  if (invocation.rawIdentityJoinsRequested === true) {
    return makeReceipt(invocation, 'hard_block', 'Raw identity join requested. Raw identity joins are blocked by default.', policyRefs);
  }

  if (invocation.redactionState === 'raw') {
    return makeReceipt(invocation, 'hard_block', 'Raw redaction state is not allowed for runtime invocation.', policyRefs);
  }

  if (invocation.credentialAccessRequested === true) {
    return makeReceipt(invocation, 'hard_block', 'Credential access requested. Runtime resolver blocks credential access.', policyRefs);
  }

  if (invocation.payloadBodiesRequested === true) {
    return makeReceipt(invocation, 'hard_block', 'Payload body access requested. Runtime resolver blocks payload body access.', policyRefs);
  }

  if (invocation.publicNetworkAccessRequested === true) {
    return makeReceipt(invocation, 'hard_block', 'Public network access requested. Runtime resolver blocks public-network access.', policyRefs);
  }

  if (isElevatedEngagement(invocation)) {
    if (!Array.isArray(invocation.authorizationRefs) || invocation.authorizationRefs.length === 0) {
      return makeReceipt(invocation, 'hard_block', 'Elevated engagement requires an engagement authorization reference.', policyRefs);
    }
    if (!invocation.authorizationRefs.includes(MICHAEL_APPROVED_ELEVATED_AUTH)) {
      return makeReceipt(invocation, 'hard_block', 'Elevated engagement requires Michael-approved authorization.', policyRefs);
    }
  }

  if (!Array.isArray(invocation.evidenceRefs) || invocation.evidenceRefs.length === 0 || !Array.isArray(invocation.proofRefs) || invocation.proofRefs.length === 0) {
    return makeReceipt(invocation, 'review_required', 'Invocation lacks complete evidence/proof grounding and requires review.', policyRefs);
  }

  if (invocation.capabilityClass === 'activate_deliver' && !invocation.clientScope) {
    return makeReceipt(invocation, 'review_required', 'Client activation or delivery requires clientScope.', policyRefs);
  }

  return makeReceipt(invocation, 'allow', 'Invocation allowed for dry-run runtime resolution. No live execution performed.', policyRefs);
}

function main() {
  const args = parseArgs(process.argv);
  const invocation = readJson(args.input);
  validateWithSchema(INVOCATION_SCHEMA, invocation, args.input);

  const receipt = evaluateInvocation(invocation);
  validateWithSchema(RECEIPT_SCHEMA, receipt, 'runtime decision receipt');

  if (args.out) writeJson(args.out, receipt);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);

  if (receipt.decision === 'hard_block') process.exitCode = 2;
  if (receipt.decision === 'review_required') process.exitCode = 3;
}

try {
  main();
} catch (err) {
  console.error(`wargames-runtime-resolve failed: ${err.message}`);
  process.exit(1);
}
