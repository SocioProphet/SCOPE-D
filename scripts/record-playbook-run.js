#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const CASE_SCHEMA = 'config/schemas/operator-case-bundle.schema.json';
const PLAYBOOK_SCHEMA = 'config/schemas/operator-playbook.schema.json';
const LEDGER_SCHEMA = 'config/schemas/playbook-run-ledger.schema.json';

function usage() {
  console.log('Usage: node scripts/record-playbook-run.js --case <case-index.json> --playbook <playbook.json> --operator <operatorId> [--out <ledger.json>] [--step-id <stepId> --step-status <status> --decision <decision> --evidence <ref[,ref]> --approval-ref <ref>]');
}

function parseArgs(argv) {
  const args = { casePath: null, playbookPath: null, operatorId: null, out: null, stepId: null, stepStatus: null, decision: null, evidence: [], approvalRef: null, notes: '' };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--case') { args.casePath = argv[++i]; continue; }
    if (item === '--playbook') { args.playbookPath = argv[++i]; continue; }
    if (item === '--operator') { args.operatorId = argv[++i]; continue; }
    if (item === '--out') { args.out = argv[++i]; continue; }
    if (item === '--step-id') { args.stepId = argv[++i]; continue; }
    if (item === '--step-status') { args.stepStatus = argv[++i]; continue; }
    if (item === '--decision') { args.decision = argv[++i]; continue; }
    if (item === '--evidence') { args.evidence = argv[++i].split(',').filter(Boolean); continue; }
    if (item === '--approval-ref') { args.approvalRef = argv[++i]; continue; }
    if (item === '--notes') { args.notes = argv[++i]; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.casePath) throw new Error('--case is required.');
  if (!args.playbookPath) throw new Error('--playbook is required.');
  if (!args.operatorId) throw new Error('--operator is required.');
  if ((args.stepId || args.stepStatus || args.decision) && !(args.stepId && args.stepStatus && args.decision)) {
    throw new Error('--step-id, --step-status, and --decision must be supplied together.');
  }
  return args;
}

function abs(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT, file);
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(abs(file), 'utf8'));
}

function writeJson(file, value) {
  const out = abs(file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function validate(schemaRel, value, label) {
  const schema = readJson(schemaRel);
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validator = ajv.compile(schema);
  if (!validator(value)) {
    const details = (validator.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
    throw new Error(`${label} failed schema validation: ${details}`);
  }
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'ledger';
}

function statusFor(entries) {
  if (entries.some((entry) => entry.stepStatus === 'requires_approval')) return 'requires_approval';
  if (entries.some((entry) => entry.stepStatus === 'blocked')) return 'blocked';
  if (entries.every((entry) => entry.stepStatus === 'completed' || entry.stepStatus === 'skipped')) return 'completed';
  if (entries.some((entry) => entry.stepStatus === 'in_progress' || entry.stepStatus === 'completed')) return 'in_progress';
  return 'not_started';
}

function defaultEntry(step, now) {
  return {
    stepId: step.stepId,
    stepStatus: 'not_started',
    decision: 'none',
    evidenceRefs: [],
    approvalRef: null,
    timestamp: now,
    notes: '',
    executionAllowed: false,
    executionPerformed: false,
  };
}

function main() {
  const args = parseArgs(process.argv);
  const casePath = abs(args.casePath);
  const playbookPath = abs(args.playbookPath);
  const caseIndex = readJson(casePath);
  const playbook = readJson(playbookPath);
  validate(CASE_SCHEMA, caseIndex, 'operator case bundle');
  validate(PLAYBOOK_SCHEMA, playbook, 'operator playbook');

  const matched = caseIndex.mappedPlaybooks.some((item) => item.playbookId === playbook.playbookId);
  if (!matched) throw new Error(`Playbook ${playbook.playbookId} is not mapped by case ${caseIndex.caseId}.`);

  const now = new Date().toISOString();
  const entries = playbook.operatorSteps.map((step) => defaultEntry(step, now));
  if (args.stepId) {
    const entry = entries.find((item) => item.stepId === args.stepId);
    if (!entry) throw new Error(`Step ${args.stepId} not found in playbook.`);
    entry.stepStatus = args.stepStatus;
    entry.decision = args.decision;
    entry.evidenceRefs = args.evidence;
    entry.approvalRef = args.approvalRef || null;
    entry.notes = args.notes || '';
    entry.timestamp = now;
  }

  const ledger = {
    schemaVersion: '0.1.0',
    ledgerId: `playbook-run-ledger:${slug(caseIndex.caseId.replace(/^operator-case:/, ''))}-${slug(playbook.playbookId.replace(/^operator-playbook:/, ''))}`,
    caseRef: rel(casePath),
    sourceWorkorderRef: caseIndex.sourceWorkorderRef,
    playbookId: playbook.playbookId,
    playbookPath: rel(playbookPath),
    operatorId: args.operatorId,
    ledgerStatus: statusFor(entries),
    entries,
    createdAt: now,
    updatedAt: now,
    executionAllowed: false,
    executionPerformed: false,
  };

  validate(LEDGER_SCHEMA, ledger, 'playbook run ledger');
  const outPath = abs(args.out || path.join(path.dirname(casePath), 'playbook-run-ledger.json'));
  writeJson(outPath, ledger);
  process.stdout.write(`${JSON.stringify(ledger, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  console.error(`record-playbook-run failed: ${err.message}`);
  process.exit(1);
}
