#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const WORKORDERS_SCHEMA = 'config/schemas/operator-workorders.schema.json';
const WORKORDER_SCHEMA = 'config/schemas/operator-workorder.schema.json';
const CASE_SCHEMA = 'config/schemas/operator-case-bundle.schema.json';

function usage() {
  console.log('Usage: node scripts/build-operator-case.js <operator-workorders.json> [--source-workorder <operator-workorder.json>] [--out-dir <dir>]');
}

function parseArgs(argv) {
  const args = { input: null, sourceWorkorder: null, outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--source-workorder') { args.sourceWorkorder = argv[++i]; continue; }
    if (item === '--out-dir') { args.outDir = argv[++i]; continue; }
    if (!args.input) { args.input = item; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.input) throw new Error('Missing operator-workorders path.');
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
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, 'utf8');
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
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'case';
}

function caseState(binding) {
  if (binding.approvalRequired && binding.severity === 'critical') return 'awaiting_approval';
  if (binding.status === 'remediation_required') return 'remediation_planned';
  if (binding.status === 'needs_review') return 'under_review';
  return 'open';
}

function markdown(caseIndex) {
  const lines = [];
  lines.push(`# Operator Case: ${caseIndex.caseId}`);
  lines.push('');
  lines.push(`- State: ${caseIndex.caseState}`);
  lines.push(`- Surface: ${caseIndex.surfaceKind}`);
  lines.push(`- Severity: ${caseIndex.severity}`);
  lines.push(`- Status: ${caseIndex.status}`);
  lines.push(`- Findings: ${caseIndex.findingCount}`);
  lines.push(`- Execution allowed: ${caseIndex.executionAllowed}`);
  lines.push('');
  lines.push('## Playbooks');
  for (const playbook of caseIndex.mappedPlaybooks) {
    lines.push(`- ${playbook.playbookId} (${playbook.playbookPath})`);
    lines.push(`  - matched: ${playbook.matchedCategories.join(', ')}`);
    lines.push(`  - approvalRequired: ${playbook.approvalRequired}`);
  }
  lines.push('');
  lines.push('## Artifacts');
  for (const artifact of caseIndex.artifactRefs) {
    lines.push(`- ${artifact.id}: ${artifact.path}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv);
  const workordersPath = abs(args.input);
  const workorders = readJson(workordersPath);
  validate(WORKORDERS_SCHEMA, workorders, 'operator workorders');
  if (!Array.isArray(workorders.workorders) || workorders.workorders.length === 0) throw new Error('operator workorders bundle is empty.');
  const binding = workorders.workorders[0];

  let sourceWorkorder = null;
  let sourceWorkorderPath = args.sourceWorkorder ? abs(args.sourceWorkorder) : null;
  if (sourceWorkorderPath) {
    sourceWorkorder = readJson(sourceWorkorderPath);
    validate(WORKORDER_SCHEMA, sourceWorkorder, 'operator source workorder');
  }

  const outDir = abs(args.outDir || path.join(path.dirname(workordersPath), 'case'));
  const caseIndexPath = path.join(outDir, 'case-index.json');
  const caseSummaryPath = path.join(outDir, 'case-summary.md');
  const artifactRefs = [
    { id: 'operator-workorders', path: rel(workordersPath), artifactType: 'workorders' },
    { id: 'case-index', path: rel(caseIndexPath), artifactType: 'case_index' },
    { id: 'case-summary', path: rel(caseSummaryPath), artifactType: 'case_summary' },
  ];

  if (sourceWorkorderPath) artifactRefs.push({ id: 'operator-workorder', path: rel(sourceWorkorderPath), artifactType: 'workorder' });
  for (const assessmentRef of (sourceWorkorder && sourceWorkorder.assessmentRefs) || []) artifactRefs.push({ id: `assessment-${slug(assessmentRef)}`, path: assessmentRef, artifactType: assessmentRef.includes('risk') ? 'risk_records' : 'assessment' });
  for (const playbook of binding.mappedPlaybooks) artifactRefs.push({ id: playbook.playbookId, path: playbook.playbookPath, artifactType: 'playbook' });

  const sourceRunIndexRef = (sourceWorkorder && sourceWorkorder.sourceRunIndexRef) || workorders.sourceWorkorderRef;
  const caseIndex = {
    schemaVersion: '0.1.0',
    caseId: `operator-case:${slug(binding.sourceWorkorderId.replace(/^operator-workorder:/, ''))}`,
    caseState: caseState(binding),
    sourceWorkordersRef: rel(workordersPath),
    sourceWorkorderRef: sourceWorkorderPath ? rel(sourceWorkorderPath) : workorders.sourceWorkorderRef,
    sourceRunIndexRef,
    surfaceKind: binding.surfaceKind,
    severity: binding.severity,
    status: binding.status,
    findingCount: binding.findingCount,
    mappedPlaybooks: binding.mappedPlaybooks.map((playbook) => ({
      playbookId: playbook.playbookId,
      playbookPath: playbook.playbookPath,
      matchedCategories: playbook.matchedCategories,
      approvalRequired: playbook.approvalRequired,
    })),
    artifactRefs,
    createdAt: new Date().toISOString(),
    executionAllowed: false,
    executionPerformed: false,
  };

  validate(CASE_SCHEMA, caseIndex, 'operator case bundle');
  writeJson(caseIndexPath, caseIndex);
  writeText(caseSummaryPath, markdown(caseIndex));
  process.stdout.write(`${JSON.stringify(caseIndex, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  console.error(`build-operator-case failed: ${err.message}`);
  process.exit(1);
}
