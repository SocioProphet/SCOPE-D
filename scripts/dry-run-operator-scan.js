#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const PLAN_SCHEMA = 'config/schemas/operator-scan-plan.schema.json';
const RECEIPT_SCHEMA = 'config/schemas/operator-scan-dry-run-receipt.schema.json';

function usage() {
  console.log('Usage: node scripts/dry-run-operator-scan.js <operator-scan-plan.json> [--out <receipt.json>]');
}

function parseArgs(argv) {
  const args = { plan: null, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--out') { args.out = argv[++i]; continue; }
    if (!args.plan) { args.plan = item; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.plan) throw new Error('Missing operator scan plan path.');
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
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'scan';
}

function describe(method, targetRef) {
  const descriptions = {
    passive_metadata: `Would review locally supplied metadata for ${targetRef}.`,
    dns_lookup: `Would perform a DNS lookup for ${targetRef} if execution were later authorized.`,
    tls_certificate_read: `Would read TLS certificate metadata for ${targetRef} if execution were later authorized.`,
    http_head: `Would issue an HTTP HEAD request to ${targetRef} if execution were later authorized.`,
    tcp_connect: `Would attempt a TCP connect check against ${targetRef} if execution were later authorized.`,
    service_banner_read: `Would read a service banner from ${targetRef} if execution were later authorized.`
  };
  return descriptions[method] || `Would prepare ${method} for ${targetRef}.`;
}

function main() {
  const args = parseArgs(process.argv);
  const planPath = abs(args.plan);
  const plan = readJson(planPath);
  validate(PLAN_SCHEMA, plan, 'operator scan plan');
  if (plan.scanExecutionAllowed !== false) throw new Error('Dry-run refuses scanExecutionAllowed=true.');
  if (plan.scanExecutionPerformed !== false) throw new Error('Dry-run refuses scanExecutionPerformed=true.');

  const receipt = {
    schemaVersion: '0.1.0',
    receiptId: `operator-scan-dry-run:${slug(plan.planId.replace(/^operator-scan-plan:/, ''))}`,
    planRef: rel(planPath),
    decisionRef: plan.decisionRef,
    targetRef: plan.targetRef,
    surfaceKind: plan.surfaceKind,
    intendedSteps: plan.plannedMethods.map((method, index) => ({
      stepId: `scan-step-${index + 1}-${slug(method)}`,
      method,
      targetRef: plan.targetRef,
      description: describe(method, plan.targetRef),
      executionStatus: 'not_executed',
      networkAccessAttempted: false,
    })),
    createdAt: new Date().toISOString(),
    networkAccessAttempted: false,
    scanExecutionAllowed: false,
    scanExecutionPerformed: false,
  };
  validate(RECEIPT_SCHEMA, receipt, 'operator scan dry-run receipt');
  if (args.out) writeJson(args.out, receipt);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  console.error(`dry-run-operator-scan failed: ${err.message}`);
  process.exit(1);
}
