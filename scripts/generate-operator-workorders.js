#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const WORKORDER_SCHEMA = 'config/schemas/operator-workorder.schema.json';
const PLAYBOOK_SCHEMA = 'config/schemas/operator-playbook.schema.json';
const OUTPUT_SCHEMA = 'config/schemas/operator-workorders.schema.json';
const PLAYBOOK_DIR = path.join(ROOT, 'playbooks');

function usage() {
  console.log('Usage: node scripts/generate-operator-workorders.js <operator-workorder.json> [--out-dir <dir>]');
}

function parseArgs(argv) {
  const args = { input: null, outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--out-dir') { args.outDir = argv[++i]; continue; }
    if (!args.input) { args.input = item; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.input) throw new Error('Missing operator workorder path.');
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
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'workorder';
}

function loadPlaybooks() {
  return fs.readdirSync(PLAYBOOK_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const fullPath = path.join(PLAYBOOK_DIR, file);
      const playbook = readJson(fullPath);
      validate(PLAYBOOK_SCHEMA, playbook, `playbook ${file}`);
      return { playbook, path: rel(fullPath) };
    });
}

function categoriesFromAssessment(assessment) {
  const categories = new Set();
  if (Array.isArray(assessment.findings)) {
    for (const finding of assessment.findings) {
      if (finding.category) categories.add(finding.category);
    }
  }
  if (Array.isArray(assessment.risks)) {
    for (const risk of assessment.risks) {
      if (risk.riskCategory) categories.add(risk.riskCategory);
    }
  }
  return categories;
}

function loadFindingCategories(workorder) {
  const categories = new Set();
  for (const ref of workorder.assessmentRefs || []) {
    const data = readJson(ref);
    const sources = [];
    if (data.assessment) sources.push(data.assessment);
    if (Array.isArray(data.risks)) sources.push({ risks: data.risks });
    if (Array.isArray(data)) sources.push({ risks: data });
    sources.push(data);
    for (const source of sources) {
      for (const category of categoriesFromAssessment(source)) categories.add(category);
    }
  }
  return Array.from(categories).sort();
}

function matchPlaybooks(workorder, findingCategories, playbooks) {
  const findingSet = new Set(findingCategories);
  return playbooks
    .filter(({ playbook }) => playbook.surfaceKinds.includes(workorder.surfaceKind) || playbook.surfaceKinds.includes('cross_surface'))
    .map(({ playbook, path: playbookPath }) => {
      const matchedCategories = playbook.triggerCategories.filter((category) => findingSet.has(category));
      if (matchedCategories.length === 0) return null;
      return {
        playbookId: playbook.playbookId,
        playbookPath,
        matchedCategories,
        approvalRequired: playbook.approvalRequired || workorder.approvalRequired,
        blockedActions: Array.from(new Set([...(playbook.blockedActions || []), ...(workorder.blockedActions || [])])).sort(),
        reassessmentCommand: playbook.reassessmentCommand,
      };
    })
    .filter(Boolean);
}

function markdown(bundle) {
  const lines = [];
  lines.push(`# Operator Workorders: ${bundle.bundleId}`);
  lines.push('');
  lines.push(`Source workorder: ${bundle.sourceWorkorderRef}`);
  lines.push(`Execution allowed: ${bundle.executionAllowed}`);
  lines.push('');
  for (const item of bundle.workorders) {
    lines.push(`## ${item.workorderId}`);
    lines.push('');
    lines.push(`- Surface: ${item.surfaceKind}`);
    lines.push(`- Severity: ${item.severity}`);
    lines.push(`- Status: ${item.status}`);
    lines.push(`- Findings: ${item.findingCount}`);
    lines.push(`- Approval required: ${item.approvalRequired}`);
    lines.push(`- Execution allowed: ${item.executionAllowed}`);
    lines.push('');
    lines.push('### Finding categories');
    for (const category of item.findingCategories) lines.push(`- ${category}`);
    lines.push('');
    lines.push('### Mapped playbooks');
    for (const playbook of item.mappedPlaybooks) {
      lines.push(`- ${playbook.playbookId} (${playbook.playbookPath})`);
      lines.push(`  - matched: ${playbook.matchedCategories.join(', ')}`);
      lines.push(`  - reassess: ${playbook.reassessmentCommand}`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv);
  const inputAbs = abs(args.input);
  const workorder = readJson(inputAbs);
  validate(WORKORDER_SCHEMA, workorder, 'operator workorder');

  const playbooks = loadPlaybooks();
  const findingCategories = loadFindingCategories(workorder);
  const mappedPlaybooks = matchPlaybooks(workorder, findingCategories, playbooks);
  if (mappedPlaybooks.length === 0) throw new Error('No playbooks matched the workorder finding categories.');

  const outDir = abs(args.outDir || path.dirname(inputAbs));
  const bundle = {
    schemaVersion: '0.1.0',
    bundleId: `operator-workorders:${slug(workorder.workorderId.replace(/^operator-workorder:/, ''))}`,
    sourceWorkorderRef: rel(inputAbs),
    generatedAt: new Date().toISOString(),
    workorders: [
      {
        workorderId: `operator-workorder-binding:${slug(workorder.workorderId.replace(/^operator-workorder:/, ''))}`,
        sourceWorkorderId: workorder.workorderId,
        surfaceKind: workorder.surfaceKind,
        severity: workorder.severity,
        status: workorder.status,
        findingCount: workorder.findingCount,
        findingCategories,
        mappedPlaybooks,
        approvalRequired: workorder.approvalRequired || mappedPlaybooks.some((item) => item.approvalRequired),
        executionAllowed: false,
        executionPerformed: false,
      },
    ],
    executionAllowed: false,
    executionPerformed: false,
  };
  validate(OUTPUT_SCHEMA, bundle, 'operator workorders');

  const jsonPath = path.join(outDir, 'operator-workorders.json');
  const mdPath = path.join(outDir, 'operator-workorders.md');
  writeJson(jsonPath, bundle);
  writeText(mdPath, markdown(bundle));
  process.stdout.write(`${JSON.stringify(bundle, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  console.error(`generate-operator-workorders failed: ${err.message}`);
  process.exit(1);
}
