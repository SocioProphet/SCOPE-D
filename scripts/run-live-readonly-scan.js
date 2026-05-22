#!/usr/bin/env node
'use strict';

const dns = require('dns').promises;
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const tls = require('tls');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const PLAN_SCHEMA = 'config/schemas/operator-scan-plan.schema.json';
const CAPABILITY_DECISION_SCHEMA = 'config/schemas/operator-capability-gate-decision.schema.json';
const RECEIPT_SCHEMA = 'config/schemas/operator-live-readonly-scan-receipt.schema.json';

function usage() {
  console.log('Usage: node scripts/run-live-readonly-scan.js --plan <operator-scan-plan.json> --capability-decision <decision.json> --mode <mock_live_readonly|live_readonly> [--mock-source <local-source.json>] [--out <receipt.json>]');
}

function parseArgs(argv) {
  const args = { plan: null, capabilityDecision: null, mode: null, mockSource: null, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--plan') { args.plan = argv[++i]; continue; }
    if (item === '--capability-decision') { args.capabilityDecision = argv[++i]; continue; }
    if (item === '--mode') { args.mode = argv[++i]; continue; }
    if (item === '--mock-source') { args.mockSource = argv[++i]; continue; }
    if (item === '--out') { args.out = argv[++i]; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  for (const key of ['plan', 'capabilityDecision', 'mode']) {
    if (!args[key]) throw new Error(`--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)} is required.`);
  }
  if (!['mock_live_readonly', 'live_readonly'].includes(args.mode)) throw new Error('--mode must be mock_live_readonly or live_readonly.');
  if (args.mode === 'mock_live_readonly' && !args.mockSource) throw new Error('--mock-source is required for mock_live_readonly mode.');
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
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'live-readonly';
}

function assertAuthorized(plan, capabilityDecision, mode) {
  if (capabilityDecision.decision !== 'allow_mode') throw new Error('Capability decision must be allow_mode.');
  if (capabilityDecision.targetRef !== plan.targetRef) throw new Error('Capability decision target mismatch.');
  if (capabilityDecision.surfaceKind !== plan.surfaceKind) throw new Error('Capability decision surface mismatch.');
  if (!capabilityDecision.allowedModes.includes('live_readonly')) throw new Error('Capability decision does not allow live_readonly mode.');
  if (!capabilityDecision.allowedCapabilityClasses.includes('network_access')) throw new Error('Capability decision does not allow network_access capability.');
  if (capabilityDecision.blockedCapabilityClasses.includes('credential_access') === false) throw new Error('Capability decision must block credential_access.');
  if (capabilityDecision.blockedCapabilityClasses.includes('payload_delivery') === false) throw new Error('Capability decision must block payload_delivery.');
  if (capabilityDecision.executionEnabled !== false || capabilityDecision.executionPerformed !== false) throw new Error('Capability decision execution flags must remain false.');
  if (mode === 'live_readonly' && process.env.SCOPE_D_ENABLE_LIVE_READONLY !== '1') {
    throw new Error('live_readonly mode requires SCOPE_D_ENABLE_LIVE_READONLY=1.');
  }
}

function observation(idSuffix, method, status, evidence, findingHint) {
  return {
    observationId: `live-readonly-observation:${slug(idSuffix)}`,
    method,
    status,
    evidence,
    findingHint,
  };
}

function mockObservations(plan, mockSourcePath) {
  const source = readJson(mockSourcePath);
  const allowed = new Set(plan.plannedMethods);
  return source.observations
    .filter((item) => allowed.has(item.method))
    .map((item, index) => observation(`${plan.targetRef}-${index + 1}-${item.method}`, item.method, item.status, item.evidence, item.findingHint));
}

async function httpHead(targetRef) {
  const url = targetRef.startsWith('http://') || targetRef.startsWith('https://') ? new URL(targetRef) : new URL(`https://${targetRef}`);
  const client = url.protocol === 'http:' ? http : https;
  return new Promise((resolve) => {
    const req = client.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
      const headers = Object.fromEntries(Object.entries(res.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : String(value)]));
      res.resume();
      resolve(observation(`${targetRef}-http-head`, 'http_head', 'observed', { statusCode: res.statusCode || 0, headers }, 'http_exposure'));
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', (err) => resolve(observation(`${targetRef}-http-head`, 'http_head', 'error', { error: err.message }, 'scan_incomplete')));
    req.end();
  });
}

async function dnsLookup(targetRef) {
  const host = targetRef.replace(/^https?:\/\//, '').split('/')[0];
  try {
    const records = await dns.lookup(host, { all: true });
    return observation(`${targetRef}-dns`, 'dns_lookup', 'observed', { resolved: records.length > 0, addressCount: records.length, families: Array.from(new Set(records.map((item) => item.family))).sort() }, 'none');
  } catch (err) {
    return observation(`${targetRef}-dns`, 'dns_lookup', 'error', { error: err.message }, 'unresolved_target');
  }
}

async function tlsRead(targetRef) {
  const host = targetRef.replace(/^https?:\/\//, '').split('/')[0];
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: 5000, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      resolve(observation(`${targetRef}-tls`, 'tls_certificate_read', cert && Object.keys(cert).length ? 'observed' : 'not_observed', { tlsCertificatePresent: Boolean(cert && Object.keys(cert).length), subject: cert.subject || {}, issuer: cert.issuer || {}, validTo: cert.valid_to || null }, cert && Object.keys(cert).length ? 'none' : 'missing_tls'));
    });
    socket.on('timeout', () => { socket.destroy(new Error('timeout')); });
    socket.on('error', (err) => resolve(observation(`${targetRef}-tls`, 'tls_certificate_read', 'error', { error: err.message }, 'scan_incomplete')));
  });
}

async function liveObservations(plan) {
  const observations = [];
  for (const method of plan.plannedMethods) {
    if (method === 'passive_metadata') observations.push(observation(`${plan.targetRef}-passive`, method, 'observed', { source: 'live-readonly-runner', note: 'Planner metadata only.' }, 'none'));
    else if (method === 'dns_lookup') observations.push(await dnsLookup(plan.targetRef));
    else if (method === 'tls_certificate_read') observations.push(await tlsRead(plan.targetRef));
    else if (method === 'http_head') observations.push(await httpHead(plan.targetRef));
    else observations.push(observation(`${plan.targetRef}-${method}`, method, 'not_supported', { reason: 'Method intentionally not implemented in live-readonly runner.' }, 'scan_incomplete'));
  }
  return observations;
}

async function main() {
  const args = parseArgs(process.argv);
  const planPath = abs(args.plan);
  const capabilityDecisionPath = abs(args.capabilityDecision);
  const plan = readJson(planPath);
  const capabilityDecision = readJson(capabilityDecisionPath);
  validate(PLAN_SCHEMA, plan, 'operator scan plan');
  validate(CAPABILITY_DECISION_SCHEMA, capabilityDecision, 'operator capability gate decision');
  assertAuthorized(plan, capabilityDecision, args.mode);

  const observations = args.mode === 'mock_live_readonly' ? mockObservations(plan, args.mockSource) : await liveObservations(plan);
  if (observations.length === 0) throw new Error('No observations were produced.');

  const receipt = {
    schemaVersion: '0.1.0',
    receiptId: `operator-live-readonly-scan-receipt:${slug(plan.planId.replace(/^operator-scan-plan:/, ''))}`,
    planRef: rel(planPath),
    capabilityDecisionRef: rel(capabilityDecisionPath),
    targetRef: plan.targetRef,
    surfaceKind: plan.surfaceKind,
    mode: args.mode,
    observations,
    createdAt: new Date().toISOString(),
    networkAccessAttempted: args.mode === 'live_readonly',
    liveReadOnlyPerformed: args.mode === 'live_readonly',
    credentialAccessAttempted: false,
    payloadDeliveryAttempted: false,
    mutationAttempted: false,
    destructiveBehaviorAttempted: false,
  };
  validate(RECEIPT_SCHEMA, receipt, 'operator live read-only scan receipt');
  if (args.out) writeJson(args.out, receipt);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

main().catch((err) => {
  console.error(`run-live-readonly-scan failed: ${err.message}`);
  process.exit(1);
});
