#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const RESOLVER = path.join(ROOT, 'scripts', 'wargames-runtime-resolve.js');
const INVOCATION_SCHEMA = 'config/schemas/wargames-invocation-envelope.schema.json';
const RECEIPT_SCHEMA = 'config/schemas/wargames-runtime-decision-receipt.schema.json';
const SUMMARY_SCHEMA = 'config/schemas/wargames-dispatch-summary.schema.json';

function usage() {
  console.log('Usage: node scripts/wargames-dispatch.js <invocation-envelope.json> [--run-id <scope-d-wargames-id>] [--out-dir <runs/path>]');
}

function parseArgs(argv) {
  const args = { input: null, runId: null, outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') {
      usage();
      process.exit(0);
    }
    if (item === '--run-id') {
      args.runId = argv[i + 1];
      i += 1;
      continue;
    }
    if (item === '--out-dir') {
      args.outDir = argv[i + 1];
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

function readJson(relOrAbsPath) {
  const absPath = path.isAbsolute(relOrAbsPath) ? relOrAbsPath : path.join(ROOT, relOrAbsPath);
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}

function writeJson(absPath, value) {
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

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/^[^a-z0-9]+/, '')
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'dispatch';
}

function timestampSlug() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').toLowerCase();
}

function decisionStatus(decision) {
  if (decision === 'allow' || decision === 'soft_warn' || decision === 'audit_only') return 'completed';
  if (decision === 'review_required') return 'review_required';
  return 'blocked';
}

function runResolver(inputPath, receiptPath) {
  const result = childProcess.spawnSync(process.execPath, [RESOLVER, inputPath, '--out', receiptPath], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (![0, 2, 3].includes(result.status)) {
    const stdout = result.stdout ? `\nstdout:\n${result.stdout}` : '';
    const stderr = result.stderr ? `\nstderr:\n${result.stderr}` : '';
    throw new Error(`Resolver failed unexpectedly with status ${result.status}.${stdout}${stderr}`);
  }

  if (!result.stdout) throw new Error('Resolver emitted no decision receipt JSON.');
  return JSON.parse(result.stdout);
}

function main() {
  const args = parseArgs(process.argv);
  const invocationInputAbs = path.isAbsolute(args.input) ? args.input : path.join(ROOT, args.input);
  const invocation = readJson(invocationInputAbs);
  validateWithSchema(INVOCATION_SCHEMA, invocation, 'invocation envelope');

  const runId = args.runId || `scope-d-wargames-${timestampSlug()}-${slug(invocation.invocationId.replace(/^wargames-invocation:/, ''))}`;
  if (!/^scope-d-wargames-[a-z0-9][a-z0-9._:-]*$/.test(runId)) {
    throw new Error('--run-id must match ^scope-d-wargames-[a-z0-9][a-z0-9._:-]*$');
  }

  const runDir = path.isAbsolute(args.outDir || '')
    ? args.outDir
    : path.join(ROOT, args.outDir || path.join('runs', runId));

  if (fs.existsSync(runDir)) {
    throw new Error(`Run directory already exists: ${path.relative(ROOT, runDir)}`);
  }

  fs.mkdirSync(runDir, { recursive: true });
  const invocationPath = path.join(runDir, 'invocation.json');
  const receiptPath = path.join(runDir, 'runtime-decision-receipt.json');
  const summaryPath = path.join(runDir, 'dispatch-summary.json');

  writeJson(invocationPath, invocation);
  const receipt = runResolver(invocationPath, receiptPath);
  validateWithSchema(RECEIPT_SCHEMA, receipt, 'runtime decision receipt');

  const now = new Date().toISOString();
  const summary = {
    schemaVersion: '0.1.0',
    dispatchId: `wargames-dispatch:${runId.replace(/^scope-d-wargames-/, '')}`,
    runId,
    invocationRef: path.relative(ROOT, invocationPath),
    receiptRef: path.relative(ROOT, receiptPath),
    decision: receipt.decision,
    requestedAction: invocation.requestedAction,
    capabilityClass: invocation.capabilityClass,
    dryRunOnly: true,
    liveExecutionPerformed: false,
    createdAt: now,
    status: decisionStatus(receipt.decision),
  };
  validateWithSchema(SUMMARY_SCHEMA, summary, 'dispatch summary');
  writeJson(summaryPath, summary);

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  if (receipt.decision === 'hard_block' || receipt.decision === 'limit') process.exitCode = 2;
  if (receipt.decision === 'review_required') process.exitCode = 3;
}

try {
  main();
} catch (err) {
  console.error(`wargames-dispatch failed: ${err.message}`);
  process.exit(1);
}
