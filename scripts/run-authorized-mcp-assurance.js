#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const AUTH_DISCOVERY = 'scripts/run-authorized-mcp-discovery.js';
const OPERATOR_INTAKE = 'scripts/operator-intake.js';
const WORKORDER_BINDER = 'scripts/generate-operator-workorders.js';
const CASE_BUILDER = 'scripts/build-operator-case.js';
const DASHBOARD = 'scripts/export-operator-dashboard.js';
const CLIENT_REPORT = 'scripts/export-client-assurance-report.js';
const RUN_SCHEMA = 'config/schemas/authorized-mcp-assurance-run.schema.json';

function usage() {
  console.log('Usage: node scripts/run-authorized-mcp-assurance.js --request <request.json> --policy <policy.json> --client <clientRef> [--mock-response <path> | --endpoint <url>] [--run-id <id>] [--out-dir <dir>]');
}

function parseArgs(argv) {
  const args = { request: null, policy: null, client: null, mockResponse: null, endpoint: null, runId: null, outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--request') { args.request = argv[++i]; continue; }
    if (item === '--policy') { args.policy = argv[++i]; continue; }
    if (item === '--client') { args.client = argv[++i]; continue; }
    if (item === '--mock-response') { args.mockResponse = argv[++i]; continue; }
    if (item === '--endpoint') { args.endpoint = argv[++i]; continue; }
    if (item === '--run-id') { args.runId = argv[++i]; continue; }
    if (item === '--out-dir') { args.outDir = argv[++i]; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.request) throw new Error('--request is required.');
  if (!args.policy) throw new Error('--policy is required.');
  if (!args.client) throw new Error('--client is required.');
  if (args.mockResponse && args.endpoint) throw new Error('Use either --mock-response or --endpoint, not both.');
  if (!args.mockResponse && !args.endpoint) throw new Error('One of --mock-response or --endpoint is required.');
  return args;
}

function abs(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT, file);
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'mcp-assurance';
}

function timestampSlug() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').toLowerCase();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(abs(file), 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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

function run(scriptRel, args) {
  const result = cp.spawnSync(process.execPath, [path.join(ROOT, scriptRel), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.status !== 0) throw new Error(`${scriptRel} failed with status ${result.status}: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

function main() {
  const args = parseArgs(process.argv);
  const runId = args.runId || `authorized-mcp-assurance-run:${timestampSlug()}-${slug(args.client)}`;
  if (!/^authorized-mcp-assurance-run:[a-z0-9][a-z0-9._:-]*$/.test(runId)) throw new Error('--run-id must match authorized-mcp-assurance-run:<slug>');
  const dirSlug = runId.replace(/^authorized-mcp-assurance-run:/, '');
  const outDir = abs(args.outDir || path.join('runs', `authorized-mcp-assurance-${dirSlug}`));
  if (fs.existsSync(outDir)) throw new Error(`Run directory already exists: ${rel(outDir)}`);
  fs.mkdirSync(outDir, { recursive: true });

  const discoveryDir = path.join(outDir, 'authorized-discovery');
  const discoveryArgs = [
    '--request', abs(args.request),
    '--policy', abs(args.policy),
    '--run-id', `authorized-mcp-discovery-run:${dirSlug}`,
    '--out-dir', discoveryDir,
  ];
  if (args.mockResponse) discoveryArgs.push('--mock-response', abs(args.mockResponse));
  if (args.endpoint) discoveryArgs.push('--endpoint', args.endpoint);
  const discovery = run(AUTH_DISCOVERY, discoveryArgs);

  const operatorDir = path.join(outDir, 'operator');
  run(OPERATOR_INTAKE, [abs(discovery.surfaceRunIndexRef), '--out-dir', operatorDir]);
  run(WORKORDER_BINDER, [path.join(operatorDir, 'operator-workorder.json'), '--out-dir', operatorDir]);

  const caseDir = path.join(operatorDir, 'case');
  run(CASE_BUILDER, [
    path.join(operatorDir, 'operator-workorders.json'),
    '--source-workorder', path.join(operatorDir, 'operator-workorder.json'),
    '--out-dir', caseDir,
  ]);

  const dashboardDir = path.join(outDir, 'dashboard');
  run(DASHBOARD, [
    '--case', path.join(caseDir, 'case-index.json'),
    '--out-dir', dashboardDir,
  ]);

  const clientDir = path.join(outDir, 'client-report');
  run(CLIENT_REPORT, [
    '--dashboard', path.join(dashboardDir, 'operator-dashboard.json'),
    '--client', args.client,
    '--case', path.join(caseDir, 'case-index.json'),
    '--out-dir', clientDir,
  ]);

  const assurance = {
    schemaVersion: '0.1.0',
    runId,
    authorizedDiscoveryRef: rel(path.join(discoveryDir, 'authorized-mcp-discovery-run.json')),
    surfaceRunIndexRef: discovery.surfaceRunIndexRef,
    operatorWorkflowRef: rel(path.join(operatorDir, 'operator-workflow-run.json')),
    operatorWorkordersRef: rel(path.join(operatorDir, 'operator-workorders.json')),
    caseIndexRef: rel(path.join(caseDir, 'case-index.json')),
    dashboardRef: rel(path.join(dashboardDir, 'operator-dashboard.json')),
    clientReportRef: rel(path.join(clientDir, 'client-assurance-report.json')),
    createdAt: new Date().toISOString(),
    clientRef: args.client,
    liveConnectionUsed: discovery.liveConnectionUsed === true,
    executionAllowed: false,
    executionPerformed: false,
  };
  validate(RUN_SCHEMA, assurance, 'authorized MCP assurance run');
  writeJson(path.join(outDir, 'authorized-mcp-assurance-run.json'), assurance);
  process.stdout.write(`${JSON.stringify(assurance, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  console.error(`run-authorized-mcp-assurance failed: ${err.message}`);
  process.exit(1);
}
