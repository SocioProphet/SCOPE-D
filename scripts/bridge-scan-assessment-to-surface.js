#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const SCAN_ASSESSMENT_SCHEMA = 'config/schemas/operator-scan-result-assessment.schema.json';
const SURFACE_INDEX_SCHEMA = 'config/schemas/surface-assessment-run-index.schema.json';

function usage() {
  console.log('Usage: node scripts/bridge-scan-assessment-to-surface.js <operator-scan-result-assessment.json> [--out-dir <dir>] [--run-id <id>]');
}

function parseArgs(argv) {
  const args = { input: null, outDir: null, runId: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--out-dir') { args.outDir = argv[++i]; continue; }
    if (item === '--run-id') { args.runId = argv[++i]; continue; }
    if (!args.input) { args.input = item; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.input) throw new Error('Missing scan result assessment path.');
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

function writeText(file, value) {
  const out = abs(file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, value, 'utf8');
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
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'scan-assessment';
}

function summary(index) {
  return [
    `# Scan Surface Bridge: ${index.runId}`,
    '',
    `- Surface: ${index.surfaceKind}`,
    `- Risk: ${index.riskLevel} (${index.riskScore}/100)`,
    `- Findings: ${index.findingCount}`,
    `- Execution performed: ${index.executionPerformed}`,
    '',
  ].join('\n');
}

try {
  const args = parseArgs(process.argv);
  const inputPath = abs(args.input);
  const assessment = readJson(inputPath);
  validate(SCAN_ASSESSMENT_SCHEMA, assessment, 'operator scan result assessment');
  if (assessment.networkAccessAttempted !== false || assessment.scanExecutionPerformed !== false) {
    throw new Error('Bridge refuses scan assessments with network or execution flags.');
  }

  const runId = args.runId || `scope-d-surface-${slug(assessment.assessmentId.replace(/^operator-scan-result-assessment:/, ''))}`;
  if (!/^scope-d-surface-[a-z0-9][a-z0-9._:-]*$/.test(runId)) throw new Error('--run-id must match scope-d-surface-<slug>.');
  const outDir = abs(args.outDir || path.join('runs', runId));
  const indexPath = path.join(outDir, 'surface-run-index.json');
  const summaryPath = path.join(outDir, 'surface-summary.md');

  const index = {
    schemaVersion: '0.1.0',
    runId,
    surfaceKind: assessment.surfaceKind,
    inputRef: rel(inputPath),
    artifacts: [
      { id: 'scan-result-assessment', path: rel(inputPath), artifactType: 'assessment' },
      { id: 'summary', path: rel(summaryPath), artifactType: 'summary' },
      { id: 'index', path: rel(indexPath), artifactType: 'index' }
    ],
    riskScore: assessment.riskScore,
    riskLevel: assessment.riskLevel,
    findingCount: assessment.findingCount,
    createdAt: new Date().toISOString(),
    liveConnectionUsed: false,
    executionPerformed: false,
  };

  validate(SURFACE_INDEX_SCHEMA, index, 'surface run index');
  writeJson(indexPath, index);
  writeText(summaryPath, summary(index));
  process.stdout.write(`${JSON.stringify(index, null, 2)}\n`);
} catch (err) {
  console.error(`bridge-scan-assessment-to-surface failed: ${err.message}`);
  process.exit(1);
}
