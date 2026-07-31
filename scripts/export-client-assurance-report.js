#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const { compose } = require('./epistemic-lattice');
const { composeProofEpistemic, loadProofArtifacts } = require('./compose-run-epistemic');

const ROOT = path.resolve(__dirname, '..');
const DASHBOARD_SCHEMA = 'config/schemas/operator-dashboard-index.schema.json';
const CASE_SCHEMA = 'config/schemas/operator-case-bundle.schema.json';
const REASSESSMENT_SCHEMA = 'config/schemas/operator-reassessment-report.schema.json';
const REPORT_SCHEMA = 'config/schemas/client-assurance-report.schema.json';

function usage() {
  console.log('Usage: node scripts/export-client-assurance-report.js --dashboard <operator-dashboard.json> --client <clientRef> [--case <case-index.json> ...] [--reassessment <report.json> ...] [--run <run-dir> ...] [--out-dir <dir>]');
}

function parseArgs(argv) {
  const args = { dashboard: null, client: null, cases: [], reassessments: [], runs: [], outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--dashboard') { args.dashboard = argv[++i]; continue; }
    if (item === '--client') { args.client = argv[++i]; continue; }
    if (item === '--case') { args.cases.push(argv[++i]); continue; }
    if (item === '--reassessment') { args.reassessments.push(argv[++i]); continue; }
    if (item === '--run') { args.runs.push(argv[++i]); continue; }
    if (item === '--out-dir') { args.outDir = argv[++i]; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.dashboard) throw new Error('--dashboard is required.');
  if (!args.client) throw new Error('--client is required.');
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
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'client';
}

function approvalState(dashboard) {
  if (dashboard.awaitingApprovalCount > 0) return 'awaiting_approval';
  return 'none_required';
}

function reassessmentStatus(reassessments) {
  if (reassessments.length === 0) return 'not_reassessed';
  const outcomes = new Set(reassessments.map((item) => item.outcome));
  if (outcomes.size === 1) return Array.from(outcomes)[0];
  return 'mixed';
}

function priorityFromCount(count) {
  if (count >= 5) return 'critical';
  if (count >= 3) return 'high';
  if (count >= 1) return 'medium';
  return 'low';
}

function recommendedActions(dashboard) {
  return dashboard.mappedPlaybookCounts.map((item) => ({
    actionId: `recommended-action:${slug(item.playbookId)}`,
    title: `Review and plan controls from ${item.playbookId}`,
    sourcePlaybookId: item.playbookId,
    priority: priorityFromCount(item.count),
    executionAllowed: false,
  }));
}

function evidenceRefs(dashboardPath, cases, reassessments) {
  const refs = [
    { id: 'operator-dashboard', path: rel(abs(dashboardPath)), evidenceType: 'dashboard' },
  ];
  for (const item of cases) refs.push({ id: item.caseId, path: item.path, evidenceType: 'case' });
  for (const item of cases) {
    for (const artifact of item.artifactRefs || []) {
      if (['assessment', 'risk_records', 'workorder', 'playbook'].includes(artifact.artifactType)) {
        refs.push({ id: artifact.id, path: artifact.path, evidenceType: artifact.artifactType === 'risk_records' ? 'assessment' : artifact.artifactType });
      }
    }
  }
  for (const item of reassessments) refs.push({ id: item.reportId, path: item.path, evidenceType: 'reassessment' });
  return refs;
}

/** The composed epistemic standing of a single assured run: prefer the run's
 * run-summary.epistemicStanding, else compose from its proof artifacts. */
function runEpistemic(runPath) {
  const runAbs = abs(runPath);
  const summaryPath = path.join(runAbs, 'run-summary.json');
  if (fs.existsSync(summaryPath)) {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    if (summary.epistemicStanding) {
      return {
        runRef: rel(runAbs),
        standing: summary.epistemicStanding.standing,
        proofCount: summary.epistemicStanding.proofCount,
      };
    }
  }
  const proofPath = path.join(runAbs, 'proof-artifact.json');
  if (fs.existsSync(proofPath)) {
    const composed = composeProofEpistemic(loadProofArtifacts(proofPath));
    return { runRef: rel(runAbs), standing: composed.composedEpistemicStanding, proofCount: composed.proofCount };
  }
  return null;
}

/** Fold the assured runs into one client-facing epistemic standing: the meet
 * across runs (no stronger than the weakest run; rejected absorbing). */
function composeRuns(runPaths) {
  const perRun = runPaths.map(runEpistemic).filter(Boolean);
  if (perRun.length === 0) return null;
  return {
    standing: compose(perRun.map((r) => r.standing)),
    runsConsidered: perRun.length,
    perRun,
  };
}

function summaryText(dashboard) {
  return `SCOPE-D assessed ${dashboard.caseCount} operator case(s) across ${dashboard.riskBySurface.length} surface kind(s), with ${dashboard.criticalCaseCount} critical case(s) and ${dashboard.awaitingApprovalCount} case(s) awaiting approval.`;
}

function markdown(report) {
  const lines = [];
  lines.push(`# SCOPE-D Client Assurance Report: ${report.reportId}`);
  lines.push('');
  lines.push(`Client: ${report.clientRef}`);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push('## Executive Summary');
  lines.push(report.executiveSummary.summaryText);
  lines.push('');
  if (report.epistemicStanding) {
    lines.push('## Epistemic Standing');
    lines.push(
      `Composed epistemic standing across ${report.epistemicStanding.runsConsidered} assured run(s): **${report.epistemicStanding.standing}**.`,
    );
    lines.push('');
    lines.push(
      'The standing is the meet of the assured runs — no stronger than the weakest run, and a rejected run is absorbing.',
    );
    for (const run of report.epistemicStanding.perRun) {
      lines.push(`- ${run.runRef}: ${run.standing} (${run.proofCount} proof(s))`);
    }
    lines.push('');
  }
  lines.push('## Surface Coverage');
  for (const surface of report.surfaceCoverage) {
    lines.push(`- ${surface.surfaceKind}: ${surface.caseCount} case(s); critical=${surface.critical}, high=${surface.high}, medium=${surface.medium}, low=${surface.low}`);
  }
  lines.push('');
  lines.push('## Top Risks');
  for (const risk of report.topRisks.slice(0, 10)) lines.push(`- ${risk.category}: ${risk.count}`);
  lines.push('');
  lines.push('## Recommended Actions');
  for (const action of report.recommendedActions) lines.push(`- ${action.title} [priority=${action.priority}]`);
  lines.push('');
  lines.push('## Evidence References');
  for (const ref of report.evidenceRefs.slice(0, 30)) lines.push(`- ${ref.id}: ${ref.path}`);
  lines.push('');
  lines.push('## Non-Claims');
  for (const claim of report.nonClaims) lines.push(`- ${claim}`);
  lines.push('');
  lines.push(`Approval state: ${report.approvalState}`);
  lines.push(`Reassessment status: ${report.reassessmentStatus}`);
  lines.push(`Execution performed: ${report.executionPerformed}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv);
  const dashboardPath = abs(args.dashboard);
  const dashboard = readJson(dashboardPath);
  validate(DASHBOARD_SCHEMA, dashboard, 'operator dashboard');

  const cases = args.cases.map((casePath) => {
    const pathAbs = abs(casePath);
    const data = readJson(pathAbs);
    validate(CASE_SCHEMA, data, `case ${casePath}`);
    return { ...data, path: rel(pathAbs) };
  });

  const reassessments = args.reassessments.map((reportPath) => {
    const pathAbs = abs(reportPath);
    const data = readJson(pathAbs);
    validate(REASSESSMENT_SCHEMA, data, `reassessment ${reportPath}`);
    return { ...data, path: rel(pathAbs) };
  });

  const report = {
    schemaVersion: '0.1.0',
    reportId: `client-assurance-report:${slug(args.client)}`,
    clientRef: args.client,
    generatedAt: new Date().toISOString(),
    sourceDashboardRef: rel(dashboardPath),
    executiveSummary: {
      caseCount: dashboard.caseCount,
      criticalCaseCount: dashboard.criticalCaseCount,
      awaitingApprovalCount: dashboard.awaitingApprovalCount,
      summaryText: summaryText(dashboard),
    },
    surfaceCoverage: dashboard.riskBySurface,
    topRisks: dashboard.topFindingCategories,
    recommendedActions: recommendedActions(dashboard),
    evidenceRefs: evidenceRefs(dashboardPath, cases, reassessments),
    nonClaims: [
      'This report does not prove exploitation occurred.',
      'This report does not perform live testing.',
      'This report does not certify full security.',
      'This report does not mutate customer systems.',
      'This report does not replace penetration testing or legal compliance review.',
      'This report summarizes evidence produced by SCOPE-D assessment workflows.'
    ],
    approvalState: approvalState(dashboard),
    reassessmentStatus: reassessmentStatus(reassessments),
    executionAllowed: false,
    executionPerformed: false,
  };

  // Surface the composed epistemic standing of the assured runs, if provided.
  const runStanding = composeRuns(args.runs);
  if (runStanding) {
    report.epistemicStanding = runStanding;
  }

  validate(REPORT_SCHEMA, report, 'client assurance report');
  const outDir = abs(args.outDir || 'reports/client-assurance');
  const jsonPath = path.join(outDir, 'client-assurance-report.json');
  const mdPath = path.join(outDir, 'client-assurance-report.md');
  writeJson(jsonPath, report);
  writeText(mdPath, markdown(report));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

module.exports = { runEpistemic, composeRuns };

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`export-client-assurance-report failed: ${err.message}`);
    process.exit(1);
  }
}
