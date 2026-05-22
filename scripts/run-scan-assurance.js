#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const RUN_SCHEMA = 'config/schemas/operator-scan-assurance-run.schema.json';
const PLANNER = 'scripts/plan-operator-scan.js';
const LOCAL_SCAN = 'scripts/run-local-passive-scan.js';
const INGEST = 'scripts/ingest-operator-scan-result.js';
const BRIDGE = 'scripts/bridge-scan-assessment-to-surface.js';
const INTAKE = 'scripts/operator-intake.js';
const WORKORDERS = 'scripts/generate-operator-workorders.js';
const CASE = 'scripts/build-operator-case.js';
const DASHBOARD = 'scripts/export-operator-dashboard.js';
const CLIENT_REPORT = 'scripts/export-client-assurance-report.js';

function usage() {
  console.log('Usage: node scripts/run-scan-assurance.js --request <request.json> --policy <policy.json> --source <local-passive-source.json> --client <clientRef> [--run-id <id>] [--out-dir <dir>]');
}

function parseArgs(argv) {
  const args = { request: null, policy: null, source: null, client: null, runId: null, outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--request') { args.request = argv[++i]; continue; }
    if (item === '--policy') { args.policy = argv[++i]; continue; }
    if (item === '--source') { args.source = argv[++i]; continue; }
    if (item === '--client') { args.client = argv[++i]; continue; }
    if (item === '--run-id') { args.runId = argv[++i]; continue; }
    if (item === '--out-dir') { args.outDir = argv[++i]; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  for (const key of ['request', 'policy', 'source', 'client']) {
    if (!args[key]) throw new Error(`--${key} is required.`);
  }
  return args;
}

function abs(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT, file);
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'scan-assurance';
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

function run(label, scriptRel, args) {
  const result = cp.spawnSync(process.execPath, [path.join(ROOT, scriptRel), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.status !== 0) throw new Error(`${label} failed with status ${result.status}: ${result.stderr || result.stdout}`);
  return result.stdout ? JSON.parse(result.stdout) : null;
}

try {
  const args = parseArgs(process.argv);
  const runId = args.runId || `operator-scan-assurance-run:${timestampSlug()}-${slug(args.client)}`;
  if (!/^operator-scan-assurance-run:[a-z0-9][a-z0-9._:-]*$/.test(runId)) throw new Error('--run-id must match operator-scan-assurance-run:<slug>');
  const runSlug = runId.replace(/^operator-scan-assurance-run:/, '');
  const outDir = abs(args.outDir || path.join('runs', `operator-scan-assurance-${runSlug}`));
  if (fs.existsSync(outDir)) throw new Error(`Run directory already exists: ${rel(outDir)}`);
  fs.mkdirSync(outDir, { recursive: true });

  const policyCopy = path.join(outDir, 'operator-scan-policy.json');
  const requestCopy = path.join(outDir, 'operator-scan-request.json');
  const sourceCopy = path.join(outDir, 'local-passive-source.json');
  fs.copyFileSync(abs(args.policy), policyCopy);
  fs.copyFileSync(abs(args.request), requestCopy);
  fs.copyFileSync(abs(args.source), sourceCopy);

  const planDir = path.join(outDir, 'plan');
  run('scan plan', PLANNER, [requestCopy, '--policy', policyCopy, '--out-dir', planDir]);

  const scanResultPath = path.join(outDir, 'operator-scan-result.json');
  const scanResult = run('local passive scan', LOCAL_SCAN, [
    '--plan', path.join(planDir, 'operator-scan-plan.json'),
    '--source', sourceCopy,
    '--out', scanResultPath,
  ]);

  const scanAssessmentPath = path.join(outDir, 'operator-scan-result-assessment.json');
  run('scan result ingestion', INGEST, [scanResultPath, '--out', scanAssessmentPath]);

  const surfaceDir = path.join(outDir, 'surface');
  run('scan surface bridge', BRIDGE, [scanAssessmentPath, '--out-dir', surfaceDir, '--run-id', `scope-d-surface-${runSlug}`]);

  const operatorDir = path.join(outDir, 'operator');
  run('operator intake', INTAKE, [path.join(surfaceDir, 'surface-run-index.json'), '--out-dir', operatorDir]);
  run('operator workorders', WORKORDERS, [path.join(operatorDir, 'operator-workorder.json'), '--out-dir', operatorDir]);

  const caseDir = path.join(operatorDir, 'case');
  run('operator case', CASE, [path.join(operatorDir, 'operator-workorders.json'), '--source-workorder', path.join(operatorDir, 'operator-workorder.json'), '--out-dir', caseDir]);

  const dashboardDir = path.join(outDir, 'dashboard');
  run('operator dashboard', DASHBOARD, ['--case', path.join(caseDir, 'case-index.json'), '--out-dir', dashboardDir]);

  const clientDir = path.join(outDir, 'client-report');
  run('client report', CLIENT_REPORT, [
    '--dashboard', path.join(dashboardDir, 'operator-dashboard.json'),
    '--client', args.client,
    '--case', path.join(caseDir, 'case-index.json'),
    '--out-dir', clientDir,
  ]);

  const index = {
    schemaVersion: '0.1.0',
    runId,
    clientRef: args.client,
    policyRef: rel(policyCopy),
    requestRef: rel(requestCopy),
    planRef: rel(path.join(planDir, 'operator-scan-plan.json')),
    scanResultRef: rel(scanResultPath),
    scanAssessmentRef: rel(scanAssessmentPath),
    surfaceRunIndexRef: rel(path.join(surfaceDir, 'surface-run-index.json')),
    operatorWorkflowRef: rel(path.join(operatorDir, 'operator-workflow-run.json')),
    operatorWorkordersRef: rel(path.join(operatorDir, 'operator-workorders.json')),
    caseIndexRef: rel(path.join(caseDir, 'case-index.json')),
    dashboardRef: rel(path.join(dashboardDir, 'operator-dashboard.json')),
    clientReportRef: rel(path.join(clientDir, 'client-assurance-report.json')),
    createdAt: new Date().toISOString(),
    networkAccessAttempted: scanResult.networkAccessAttempted,
    scanExecutionPerformed: scanResult.scanExecutionPerformed,
    executionAllowed: false,
    executionPerformed: false,
  };
  validate(RUN_SCHEMA, index, 'operator scan assurance run');
  writeJson(path.join(outDir, 'operator-scan-assurance-run.json'), index);
  process.stdout.write(`${JSON.stringify(index, null, 2)}\n`);
} catch (err) {
  console.error(`run-scan-assurance failed: ${err.message}`);
  process.exit(1);
}
