#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const CASE_SCHEMA = 'config/schemas/operator-case-bundle.schema.json';
const RUN_INDEX_SCHEMA = 'config/schemas/surface-assessment-run-index.schema.json';
const REPORT_SCHEMA = 'config/schemas/operator-reassessment-report.schema.json';

function usage() {
  console.log('Usage: node scripts/reassess-surface-case.js --case <case-index.json> --new-run-index <surface-run-index.json> [--out-dir <dir>]');
}

function parseArgs(argv) {
  const args = { casePath: null, newRunIndex: null, outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--case') { args.casePath = argv[++i]; continue; }
    if (item === '--new-run-index') { args.newRunIndex = argv[++i]; continue; }
    if (item === '--out-dir') { args.outDir = argv[++i]; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.casePath) throw new Error('--case is required.');
  if (!args.newRunIndex) throw new Error('--new-run-index is required.');
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
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'reassessment';
}

function outcome(riskDelta, findingDelta) {
  if (riskDelta < 0 || findingDelta < 0) return 'improved';
  if (riskDelta > 0 || findingDelta > 0) return 'regressed';
  if (riskDelta === 0 && findingDelta === 0) return 'unchanged';
  return 'needs_review';
}

function markdown(report) {
  return [
    `# Operator Reassessment: ${report.reportId}`,
    '',
    `- Surface: ${report.surfaceKind}`,
    `- Outcome: ${report.outcome}`,
    `- Previous risk: ${report.previousRiskLevel} (${report.previousRiskScore}/100)`,
    `- New risk: ${report.newRiskLevel} (${report.newRiskScore}/100)`,
    `- Risk delta: ${report.riskDelta}`,
    `- Finding delta: ${report.findingDelta}`,
    `- Closed finding estimate: ${report.closedFindingEstimate}`,
    `- Remaining findings: ${report.remainingFindingCount}`,
    `- New finding estimate: ${report.newFindingEstimate}`,
    `- Execution performed: ${report.executionPerformed}`,
    '',
    `Case: ${report.caseRef}`,
    `Previous run index: ${report.previousRunIndexRef}`,
    `New run index: ${report.newRunIndexRef}`,
    '',
  ].join('\n');
}

function main() {
  const args = parseArgs(process.argv);
  const casePath = abs(args.casePath);
  const newRunIndexPath = abs(args.newRunIndex);
  const caseIndex = readJson(casePath);
  const newIndex = readJson(newRunIndexPath);
  validate(CASE_SCHEMA, caseIndex, 'operator case');
  validate(RUN_INDEX_SCHEMA, newIndex, 'new surface run index');

  if (caseIndex.surfaceKind !== newIndex.surfaceKind) throw new Error(`Surface mismatch: case=${caseIndex.surfaceKind} new=${newIndex.surfaceKind}`);

  const previousRunIndexPath = abs(caseIndex.sourceRunIndexRef);
  const previousIndex = readJson(previousRunIndexPath);
  validate(RUN_INDEX_SCHEMA, previousIndex, 'previous surface run index');

  const riskDelta = newIndex.riskScore - previousIndex.riskScore;
  const findingDelta = newIndex.findingCount - previousIndex.findingCount;
  const report = {
    schemaVersion: '0.1.0',
    reportId: `operator-reassessment:${slug(caseIndex.caseId.replace(/^operator-case:/, ''))}`,
    caseRef: rel(casePath),
    previousRunIndexRef: rel(previousRunIndexPath),
    newRunIndexRef: rel(newRunIndexPath),
    surfaceKind: caseIndex.surfaceKind,
    previousRiskScore: previousIndex.riskScore,
    newRiskScore: newIndex.riskScore,
    riskDelta,
    previousRiskLevel: previousIndex.riskLevel,
    newRiskLevel: newIndex.riskLevel,
    findingDelta,
    closedFindingEstimate: Math.max(0, previousIndex.findingCount - newIndex.findingCount),
    remainingFindingCount: newIndex.findingCount,
    newFindingEstimate: Math.max(0, newIndex.findingCount - previousIndex.findingCount),
    outcome: outcome(riskDelta, findingDelta),
    createdAt: new Date().toISOString(),
    executionAllowed: false,
    executionPerformed: false,
  };

  validate(REPORT_SCHEMA, report, 'operator reassessment report');
  const outDir = abs(args.outDir || path.dirname(casePath));
  const jsonPath = path.join(outDir, 'reassessment-report.json');
  const mdPath = path.join(outDir, 'reassessment-report.md');
  writeJson(jsonPath, report);
  writeText(mdPath, markdown(report));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  console.error(`reassess-surface-case failed: ${err.message}`);
  process.exit(1);
}
