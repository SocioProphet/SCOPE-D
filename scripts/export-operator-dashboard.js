#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const CASE_SCHEMA = 'config/schemas/operator-case-bundle.schema.json';
const REASSESSMENT_SCHEMA = 'config/schemas/operator-reassessment-report.schema.json';
const DASHBOARD_SCHEMA = 'config/schemas/operator-dashboard-index.schema.json';

function usage() {
  console.log('Usage: node scripts/export-operator-dashboard.js --case <case-index.json> [--case <case-index.json> ...] [--reassessment <report.json> ...] [--out-dir <dir>]');
}

function parseArgs(argv) {
  const args = { cases: [], reassessments: [], outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--case') { args.cases.push(argv[++i]); continue; }
    if (item === '--reassessment') { args.reassessments.push(argv[++i]); continue; }
    if (item === '--out-dir') { args.outDir = argv[++i]; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (args.cases.length === 0) throw new Error('At least one --case path is required.');
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
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'dashboard';
}

function inc(map, key, by = 1) {
  map.set(key, (map.get(key) || 0) + by);
}

function surfaceRiskRows(cases) {
  const rows = new Map();
  for (const item of cases) {
    if (!rows.has(item.surfaceKind)) rows.set(item.surfaceKind, { surfaceKind: item.surfaceKind, caseCount: 0, critical: 0, high: 0, medium: 0, low: 0 });
    const row = rows.get(item.surfaceKind);
    row.caseCount += 1;
    row[item.severity] += 1;
  }
  return Array.from(rows.values()).sort((a, b) => a.surfaceKind.localeCompare(b.surfaceKind));
}

function countRows(map, keyName) {
  return Array.from(map.entries()).map(([key, count]) => ({ [keyName]: key, count })).sort((a, b) => b.count - a.count || String(a[keyName]).localeCompare(String(b[keyName])));
}

function categoriesFromCase(caseIndex) {
  const out = [];
  for (const playbook of caseIndex.mappedPlaybooks || []) {
    for (const category of playbook.matchedCategories || []) out.push(category);
  }
  return out;
}

function markdown(dashboard) {
  const lines = [];
  lines.push(`# SCOPE-D Operator Dashboard: ${dashboard.dashboardId}`);
  lines.push('');
  lines.push(`- Cases: ${dashboard.caseCount}`);
  lines.push(`- Open cases: ${dashboard.openCaseCount}`);
  lines.push(`- Awaiting approval: ${dashboard.awaitingApprovalCount}`);
  lines.push(`- Critical cases: ${dashboard.criticalCaseCount}`);
  lines.push(`- Execution performed: ${dashboard.executionPerformed}`);
  lines.push('');
  lines.push('## Risk by surface');
  for (const row of dashboard.riskBySurface) {
    lines.push(`- ${row.surfaceKind}: ${row.caseCount} cases; critical=${row.critical}, high=${row.high}, medium=${row.medium}, low=${row.low}`);
  }
  lines.push('');
  lines.push('## Cases by state');
  for (const row of dashboard.casesByState) lines.push(`- ${row.caseState}: ${row.count}`);
  lines.push('');
  lines.push('## Top finding categories');
  for (const row of dashboard.topFindingCategories.slice(0, 10)) lines.push(`- ${row.category}: ${row.count}`);
  lines.push('');
  lines.push('## Mapped playbooks');
  for (const row of dashboard.mappedPlaybookCounts) lines.push(`- ${row.playbookId}: ${row.count}`);
  lines.push('');
  lines.push('## Recent reassessments');
  for (const row of dashboard.recentReassessments) lines.push(`- ${row.reportId}: ${row.outcome}; riskDelta=${row.riskDelta}; findingDelta=${row.findingDelta}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv);
  const cases = args.cases.map((casePath) => {
    const absPath = abs(casePath);
    const data = readJson(absPath);
    validate(CASE_SCHEMA, data, `operator case ${casePath}`);
    return { path: rel(absPath), data };
  });
  const reassessments = args.reassessments.map((reportPath) => {
    const absPath = abs(reportPath);
    const data = readJson(absPath);
    validate(REASSESSMENT_SCHEMA, data, `reassessment report ${reportPath}`);
    return { path: rel(absPath), data };
  });

  const stateCounts = new Map();
  const categoryCounts = new Map();
  const playbookCounts = new Map();
  const caseSummaries = [];

  for (const item of cases) {
    const data = item.data;
    inc(stateCounts, data.caseState);
    for (const category of categoriesFromCase(data)) inc(categoryCounts, category);
    for (const playbook of data.mappedPlaybooks) inc(playbookCounts, playbook.playbookId);
    caseSummaries.push({
      caseId: data.caseId,
      caseRef: item.path,
      caseState: data.caseState,
      surfaceKind: data.surfaceKind,
      severity: data.severity,
      status: data.status,
      findingCount: data.findingCount,
      playbookCount: data.mappedPlaybooks.length,
      executionAllowed: false,
    });
  }

  const dashboard = {
    schemaVersion: '0.1.0',
    dashboardId: `operator-dashboard:${slug(new Date().toISOString().slice(0, 10))}`,
    generatedAt: new Date().toISOString(),
    caseCount: cases.length,
    openCaseCount: cases.filter((item) => !['closed', 'reassessed'].includes(item.data.caseState)).length,
    awaitingApprovalCount: cases.filter((item) => item.data.caseState === 'awaiting_approval').length,
    criticalCaseCount: cases.filter((item) => item.data.severity === 'critical').length,
    riskBySurface: surfaceRiskRows(cases.map((item) => item.data)),
    casesByState: countRows(stateCounts, 'caseState'),
    cases: caseSummaries,
    topFindingCategories: countRows(categoryCounts, 'category'),
    mappedPlaybookCounts: countRows(playbookCounts, 'playbookId'),
    recentReassessments: reassessments.map((item) => ({
      reportId: item.data.reportId,
      reportRef: item.path,
      caseRef: item.data.caseRef,
      surfaceKind: item.data.surfaceKind,
      outcome: item.data.outcome,
      riskDelta: item.data.riskDelta,
      findingDelta: item.data.findingDelta,
    })),
    executionAllowed: false,
    executionPerformed: false,
  };

  validate(DASHBOARD_SCHEMA, dashboard, 'operator dashboard index');
  const outDir = abs(args.outDir || 'reports/operator-dashboard');
  const jsonPath = path.join(outDir, 'operator-dashboard.json');
  const mdPath = path.join(outDir, 'operator-dashboard.md');
  writeJson(jsonPath, dashboard);
  writeText(mdPath, markdown(dashboard));
  process.stdout.write(`${JSON.stringify(dashboard, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  console.error(`export-operator-dashboard failed: ${err.message}`);
  process.exit(1);
}
