#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const REQUEST_SCHEMA = 'config/schemas/operator-scan-request.schema.json';
const GATE_SCHEMA = 'config/schemas/operator-capability-gate.schema.json';
const DECISION_SCHEMA = 'config/schemas/operator-capability-gate-decision.schema.json';
const HIGH_RISK = ['credential_access', 'payload_delivery', 'mutation', 'destructive_behavior'];

function usage() {
  console.log('Usage: node scripts/authorize-capability-gate.js --request <scan-request.json> --gate <capability-gate.json> [--out <decision.json>]');
}

function parseArgs(argv) {
  const args = { request: null, gate: null, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--request') { args.request = argv[++i]; continue; }
    if (item === '--gate') { args.gate = argv[++i]; continue; }
    if (item === '--out') { args.out = argv[++i]; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.request) throw new Error('--request is required.');
  if (!args.gate) throw new Error('--gate is required.');
  return args;
}

function abs(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT, file);
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
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'capability';
}

function evaluate(request, gate) {
  const blocked = [];
  if (request.operatorId !== gate.operatorId) blocked.push('operator_mismatch');
  if (!gate.authorizedTargets.includes(request.targetRef)) blocked.push('target_not_authorized');
  if (!gate.allowedModes.includes('planning')) blocked.push('planning_mode_not_allowed');

  const caps = new Set(gate.capabilityClasses || []);
  if (request.scanExecutionRequested && !caps.has('live_target_action')) blocked.push('live_target_action_not_authorized');
  const usesNetworkMethod = request.requestedMethods.some((method) => ['dns_lookup', 'tls_certificate_read', 'http_head', 'tcp_connect', 'service_banner_read'].includes(method));
  if (usesNetworkMethod && !caps.has('network_access')) blocked.push('network_access_not_authorized');
  for (const highRisk of HIGH_RISK) {
    if (caps.has(highRisk) && gate.executionEnabled === true) blocked.push(`${highRisk}_not_enabled`);
  }

  if (blocked.length > 0) {
    return { decision: 'hard_block', allowed: [], blocked: Array.from(new Set(blocked)).sort(), reason: `Capability gate blocked request: ${Array.from(new Set(blocked)).sort().join(', ')}` };
  }
  return { decision: 'allow_mode', allowed: Array.from(caps).sort(), blocked: gate.blockedClasses || [], reason: 'Capability gate allows planning path. No execution performed.' };
}

try {
  const args = parseArgs(process.argv);
  const request = readJson(args.request);
  const gate = readJson(args.gate);
  validate(REQUEST_SCHEMA, request, 'operator scan request');
  validate(GATE_SCHEMA, gate, 'operator capability gate');
  const result = evaluate(request, gate);
  const decision = {
    schemaVersion: '0.1.0',
    decisionId: `operator-capability-gate-decision:${slug(request.requestId.replace(/^operator-scan-request:/, ''))}`,
    gateId: gate.gateId,
    requestId: request.requestId,
    operatorId: request.operatorId,
    targetRef: request.targetRef,
    surfaceKind: request.surfaceKind,
    decision: result.decision,
    allowedCapabilityClasses: result.allowed,
    blockedCapabilityClasses: result.blocked,
    allowedModes: gate.allowedModes,
    reason: result.reason,
    createdAt: new Date().toISOString(),
    executionEnabled: false,
    executionPerformed: false,
  };
  validate(DECISION_SCHEMA, decision, 'operator capability gate decision');
  if (args.out) writeJson(args.out, decision);
  process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
  if (decision.decision === 'hard_block') process.exitCode = 2;
} catch (err) {
  console.error(`authorize-capability-gate failed: ${err.message}`);
  process.exit(1);
}
