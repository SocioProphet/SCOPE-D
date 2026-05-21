#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const INDEX_SCHEMA = 'config/schemas/surface-assessment-run-index.schema.json';

const SURFACES = {
  github_posture: {
    script: 'scripts/evaluate-github-posture.js',
    outName: 'github-posture-assessment.json',
    risk: (value) => ({ score: value.riskScore, level: value.riskLevel, count: value.findings.length, live: value.liveApiUsed === true }),
    artifacts: (inputRel, assessmentRel) => [
      { id: 'input', path: inputRel, artifactType: 'input' },
      { id: 'assessment', path: assessmentRel, artifactType: 'assessment' },
    ],
  },
  mcp_surface: {
    script: 'scripts/evaluate-mcp-surface.js',
    outDir: 'mcp',
    risk: (value) => ({ score: value.assessment.riskScore, level: value.assessment.riskLevel, count: value.assessment.findings.length, live: value.assessment.liveConnectionUsed === true }),
    artifacts: (inputRel, assessmentRel, risksRel) => [
      { id: 'input', path: inputRel, artifactType: 'input' },
      { id: 'assessment', path: assessmentRel, artifactType: 'assessment' },
      { id: 'risk-records', path: risksRel, artifactType: 'risk_records' },
    ],
  },
  ai_runtime: {
    script: 'scripts/evaluate-ai-runtime-exposure.js',
    outName: 'ai-runtime-exposure-assessment.json',
    risk: (value) => ({ score: value.riskScore, level: value.riskLevel, count: value.findings.length, live: value.liveConnectionUsed === true }),
    artifacts: (inputRel, assessmentRel) => [
      { id: 'input', path: inputRel, artifactType: 'input' },
      { id: 'assessment', path: assessmentRel, artifactType: 'assessment' },
    ],
  },
  k8s_manifest: {
    script: 'scripts/evaluate-k8s-manifests.js',
    outName: 'k8s-manifest-assessment.json',
    risk: (value) => ({ score: value.riskScore, level: value.riskLevel, count: value.findings.length, live: value.liveClusterAccessUsed === true }),
    artifacts: (inputRel, assessmentRel) => [
      { id: 'input', path: inputRel, artifactType: 'input' },
      { id: 'assessment', path: assessmentRel, artifactType: 'assessment' },
    ],
  },
};

function usage() {
  console.log('Usage: node scripts/run-surface-assessment.js --surface <kind> --input <path> [--run-id <id>] [--out-dir <runs/path>]');
}

function parseArgs(argv) {
  const args = { surface: null, input: null, runId: null, outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--surface') { args.surface = argv[++i]; continue; }
    if (item === '--input') { args.input = argv[++i]; continue; }
    if (item === '--run-id') { args.runId = argv[++i]; continue; }
    if (item === '--out-dir') { args.outDir = argv[++i]; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.surface || !SURFACES[args.surface]) throw new Error(`--surface must be one of ${Object.keys(SURFACES).join(', ')}`);
  if (!args.input) throw new Error('--input is required.');
  return args;
}

function abs(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT, file);
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'surface';
}

function timestampSlug() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').toLowerCase();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
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
  const schema = readJson(path.join(ROOT, schemaRel));
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const ok = ajv.compile(schema)(value);
  if (!ok) throw new Error(`${label} failed schema validation.`);
}

function run(scriptRel, args) {
  const result = cp.spawnSync(process.execPath, [path.join(ROOT, scriptRel), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.status !== 0) {
    throw new Error(`${scriptRel} failed with status ${result.status}: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

function summaryMarkdown(index) {
  return [
    `# SCOPE-D Surface Assessment: ${index.runId}`,
    '',
    `- Surface: ${index.surfaceKind}`,
    `- Risk: ${index.riskLevel} (${index.riskScore}/100)`,
    `- Findings: ${index.findingCount}`,
    `- Live connection used: ${index.liveConnectionUsed}`,
    `- Execution performed: ${index.executionPerformed}`,
    '',
    '## Artifacts',
    '',
    ...index.artifacts.map((artifact) => `- ${artifact.id}: ${artifact.path}`),
    '',
  ].join('\n');
}

function main() {
  const args = parseArgs(process.argv);
  const config = SURFACES[args.surface];
  const runId = args.runId || `scope-d-surface-${timestampSlug()}-${slug(args.surface)}`;
  if (!/^scope-d-surface-[a-z0-9][a-z0-9._:-]*$/.test(runId)) throw new Error('--run-id must match ^scope-d-surface-[a-z0-9][a-z0-9._:-]*$');

  const runDir = abs(args.outDir || path.join('runs', runId));
  if (fs.existsSync(runDir)) throw new Error(`Run directory already exists: ${rel(runDir)}`);
  fs.mkdirSync(runDir, { recursive: true });

  const inputAbs = abs(args.input);
  const inputCopy = path.join(runDir, path.basename(args.input));
  fs.copyFileSync(inputAbs, inputCopy);

  let payload;
  let artifacts;
  if (config.outDir) {
    const surfaceOutDir = path.join(runDir, config.outDir);
    payload = run(config.script, [inputCopy, '--out-dir', surfaceOutDir]);
    artifacts = config.artifacts(rel(inputCopy), rel(path.join(surfaceOutDir, 'mcp-surface-assessment.json')), rel(path.join(surfaceOutDir, 'mcp-tool-risks.json')));
  } else {
    const assessmentPath = path.join(runDir, config.outName);
    payload = run(config.script, [inputCopy, '--out', assessmentPath]);
    artifacts = config.artifacts(rel(inputCopy), rel(assessmentPath));
  }

  const risk = config.risk(payload);
  const indexPath = path.join(runDir, 'surface-run-index.json');
  const summaryPath = path.join(runDir, 'surface-summary.md');
  const index = {
    schemaVersion: '0.1.0',
    runId,
    surfaceKind: args.surface,
    inputRef: rel(inputCopy),
    artifacts: [
      ...artifacts,
      { id: 'summary', path: rel(summaryPath), artifactType: 'summary' },
      { id: 'index', path: rel(indexPath), artifactType: 'index' },
    ],
    riskScore: risk.score,
    riskLevel: risk.level,
    findingCount: risk.count,
    createdAt: new Date().toISOString(),
    liveConnectionUsed: risk.live,
    executionPerformed: false,
  };
  validate(INDEX_SCHEMA, index, 'surface assessment run index');
  writeJson(indexPath, index);
  writeText(summaryPath, summaryMarkdown(index));
  process.stdout.write(`${JSON.stringify(index, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  console.error(`run-surface-assessment failed: ${err.message}`);
  process.exit(1);
}
