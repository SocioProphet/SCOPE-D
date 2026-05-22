#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const AUTH = 'scripts/authorize-live-readonly-request.js';
const DISCOVER = 'scripts/discover-mcp-tools.js';
const NORMALIZE = 'scripts/normalize-mcp-discovery.js';
const SURFACE = 'scripts/run-surface-assessment.js';
const RUN_SCHEMA = 'config/schemas/authorized-mcp-discovery-run.schema.json';

function usage() {
  console.log('Usage: node scripts/run-authorized-mcp-discovery.js --request <request.json> --policy <policy.json> [--mock-response <path> | --endpoint <url>] [--run-id <id>] [--out-dir <dir>]');
}

function parseArgs(argv) {
  const args = { request: null, policy: null, mockResponse: null, endpoint: null, runId: null, outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--request') { args.request = argv[++i]; continue; }
    if (item === '--policy') { args.policy = argv[++i]; continue; }
    if (item === '--mock-response') { args.mockResponse = argv[++i]; continue; }
    if (item === '--endpoint') { args.endpoint = argv[++i]; continue; }
    if (item === '--run-id') { args.runId = argv[++i]; continue; }
    if (item === '--out-dir') { args.outDir = argv[++i]; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.request) throw new Error('--request is required.');
  if (!args.policy) throw new Error('--policy is required.');
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
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'mcp-discovery';
}

function timestampSlug() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').toLowerCase();
}

function run(scriptRel, args, expectedStatuses = [0]) {
  const result = cp.spawnSync(process.execPath, [path.join(ROOT, scriptRel), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (!expectedStatuses.includes(result.status)) {
    throw new Error(`${scriptRel} failed with status ${result.status}: ${result.stderr || result.stdout}`);
  }
  return result.stdout ? JSON.parse(result.stdout) : null;
}

function main() {
  const args = parseArgs(process.argv);
  const request = readJson(args.request);
  const runSlug = args.runId || `authorized-mcp-discovery-run:${timestampSlug()}-${slug(request.requestId.replace(/^operator-live-readonly-request:/, ''))}`;
  if (!/^authorized-mcp-discovery-run:[a-z0-9][a-z0-9._:-]*$/.test(runSlug)) throw new Error('--run-id must match authorized-mcp-discovery-run:<slug>');
  const dirName = runSlug.replace(/^authorized-mcp-discovery-run:/, '');
  const outDir = abs(args.outDir || path.join('runs', `authorized-mcp-discovery-${dirName}`));
  if (fs.existsSync(outDir)) throw new Error(`Run directory already exists: ${rel(outDir)}`);
  fs.mkdirSync(outDir, { recursive: true });

  const requestCopy = path.join(outDir, 'live-readonly-request.json');
  const policyCopy = path.join(outDir, 'live-readonly-policy.json');
  fs.copyFileSync(abs(args.request), requestCopy);
  fs.copyFileSync(abs(args.policy), policyCopy);

  const decisionPath = path.join(outDir, 'live-readonly-decision.json');
  const decision = run(AUTH, [requestCopy, '--policy', policyCopy, '--out', decisionPath], [0, 2]);
  if (decision.decision !== 'allow') throw new Error(`Authorization did not allow discovery: ${decision.reason}`);

  const sourcePath = path.join(outDir, 'mcp-discovery-source.json');
  const discoverArgs = [
    '--server-ref', request.targetRef,
    '--server-name', request.targetRef.replace(/^synthetic-mcp-server:/, '').replace(/[:]/g, ' '),
    '--environment', 'unknown',
    '--transport', 'http',
    '--out', sourcePath,
  ];
  if (args.mockResponse) discoverArgs.push('--mock-response', abs(args.mockResponse));
  if (args.endpoint) discoverArgs.push('--endpoint', args.endpoint);
  const source = run(DISCOVER, discoverArgs);

  const manifestPath = path.join(outDir, 'mcp-surface-manifest.json');
  run(NORMALIZE, [sourcePath, '--out', manifestPath]);

  const surfaceDir = path.join(outDir, 'surface');
  const surfaceIndex = run(SURFACE, [
    '--surface', 'mcp_surface',
    '--input', manifestPath,
    '--run-id', `scope-d-surface-${dirName}`,
    '--out-dir', surfaceDir,
  ]);

  const runIndex = {
    schemaVersion: '0.1.0',
    runId: runSlug,
    requestRef: rel(requestCopy),
    policyRef: rel(policyCopy),
    decisionRef: rel(decisionPath),
    decision: decision.decision,
    discoverySourceRef: rel(sourcePath),
    surfaceManifestRef: rel(manifestPath),
    surfaceRunIndexRef: rel(path.join(surfaceDir, 'surface-run-index.json')),
    surfaceAssessmentRef: rel(path.join(surfaceDir, 'mcp', 'mcp-surface-assessment.json')),
    riskRecordsRef: rel(path.join(surfaceDir, 'mcp', 'mcp-tool-risks.json')),
    createdAt: new Date().toISOString(),
    liveConnectionUsed: source.liveConnectionUsed === true || surfaceIndex.liveConnectionUsed === true,
    executionAllowed: false,
    executionPerformed: false,
  };
  validate(RUN_SCHEMA, runIndex, 'authorized MCP discovery run');
  writeJson(path.join(outDir, 'authorized-mcp-discovery-run.json'), runIndex);
  process.stdout.write(`${JSON.stringify(runIndex, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  console.error(`run-authorized-mcp-discovery failed: ${err.message}`);
  process.exit(1);
}
