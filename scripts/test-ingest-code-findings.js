#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INGEST = path.join(ROOT, 'scripts', 'ingest-code-findings.js');
const EXCLUSION = path.join(ROOT, 'scripts', 'hard-exclusion-rules.js');

function fail(message, result) {
  console.error(message);
  if (result && result.stderr) console.error(result.stderr);
  process.exit(1);
}
function parseJson(text, label, result) {
  try { return JSON.parse(text); } catch (err) { fail(`${label}: expected JSON output: ${err.message}`, result); }
}

// ── Unit tests for hard-exclusion-rules.js ──────────────────────────────────
const { getExclusionReason, applyHardExclusions } = require(EXCLUSION);

function assertNull(value, label) {
  if (value !== null) fail(`${label}: expected null, got "${value}"`);
}
function assertMatch(value, pattern, label) {
  if (!value || !pattern.test(value)) fail(`${label}: "${value}" did not match ${pattern}`);
}

assertNull(getExclusionReason({ file: 'src/server.ts', description: 'SQL injection via user input' }), 'SQL injection kept');
assertMatch(getExclusionReason({ file: 'src/server.md', description: 'SQL injection' }), /Markdown/, 'Markdown excluded');
assertMatch(getExclusionReason({ file: 'src/server.ts', description: 'denial of service attack' }), /DOS/, 'DoS excluded');
assertMatch(getExclusionReason({ file: 'src/server.ts', description: 'missing rate limit' }), /rate limit/, 'Rate limit excluded');
assertMatch(getExclusionReason({ file: 'src/server.ts', description: 'resource leak potential' }), /Resource/, 'Resource leak excluded');
assertMatch(getExclusionReason({ file: 'src/server.ts', description: 'open redirect attack' }), /redirect/, 'Open redirect excluded');
assertMatch(getExclusionReason({ file: 'src/server.ts', description: 'regex injection vulnerability' }), /[Rr]egex/, 'Regex injection excluded');
assertMatch(getExclusionReason({ file: 'src/server.ts', description: 'buffer overflow detected' }), /non-C/, 'Memory safety in TS excluded');
assertNull(getExclusionReason({ file: 'src/native.c', description: 'buffer overflow detected' }), 'Memory safety in C kept');
assertNull(getExclusionReason({ file: 'src/server.ts', description: 'ssrf vulnerability in backend API handler' }), 'SSRF in .ts kept');
assertMatch(getExclusionReason({ file: 'src/page.html', description: 'ssrf vulnerability' }), /SSRF.*HTML/, 'SSRF in HTML excluded');

const { kept, excluded } = applyHardExclusions([
  { file: 'src/app.ts', description: 'command injection', confidence: 0.9 },
  { file: 'src/app.ts', description: 'denial of service attack', confidence: 0.5 },
  { file: 'README.md', description: 'hardcoded secret', confidence: 0.8 },
]);
if (kept.length !== 1) fail(`Expected 1 kept, got ${kept.length}`);
if (excluded.length !== 2) fail(`Expected 2 excluded, got ${excluded.length}`);

console.log('  hard-exclusion-rules unit tests passed.');

// ── Integration test for ingest-code-findings.js ────────────────────────────
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-d-ingest-'));
const findingsPath = path.join(tmpDir, 'findings.json');
const outPath = path.join(tmpDir, 'enrichment.json');

const findings = [
  // Eligible: high confidence command injection
  {
    file: 'src/executor.ts', line: 42, severity: 'HIGH', category: 'command_injection',
    description: 'exec() called with unsanitised user input', confidence: 0.9,
    exploit_scenario: 'Attacker sends crafted input to trigger arbitrary command execution.',
    recommendation: 'Replace exec with execFile with fixed args.',
  },
  // Eligible: medium confidence credential exposure
  {
    file: 'src/config.ts', line: 12, severity: 'MEDIUM', category: 'hardcoded_secret',
    description: 'API key hardcoded in source', confidence: 0.75,
    exploit_scenario: 'Attacker reads source or git history to obtain the credential.',
    recommendation: 'Move to environment variable.',
  },
  // Excluded by hard exclusion: DoS
  {
    file: 'src/api.ts', line: 99, severity: 'MEDIUM', category: 'dos',
    description: 'denial of service attack via large payload', confidence: 0.8,
    exploit_scenario: 'Attacker sends large payload.',
    recommendation: 'Limit payload size.',
  },
  // Excluded by confidence floor (< 0.7)
  {
    file: 'src/misc.ts', line: 5, severity: 'LOW', category: 'xss',
    description: 'reflected xss in error message', confidence: 0.5,
    exploit_scenario: 'Attacker injects script.',
    recommendation: 'Escape output.',
  },
];

fs.writeFileSync(findingsPath, JSON.stringify(findings), 'utf8');

const result = cp.spawnSync(process.execPath, [INGEST, findingsPath, '--out', outPath], {
  cwd: ROOT, encoding: 'utf8', stdio: 'pipe',
});
if (result.status !== 0) fail(`ingest-code-findings failed (status ${result.status})`, result);

const enrichment = parseJson(fs.readFileSync(outPath, 'utf8'), 'enrichment output', result);

if (enrichment.executionPerformed !== false) fail('executionPerformed must be false');
if (enrichment.indicators.length !== 2) fail(`Expected 2 indicators, got ${enrichment.indicators.length}`);
if (enrichment.receipts.length !== 2) fail(`Expected 2 receipts, got ${enrichment.receipts.length}`);
if (enrichment.observations.length !== 2) fail(`Expected 2 observations, got ${enrichment.observations.length}`);
if (enrichment.graphEdges.length !== 2) fail(`Expected 2 graph edges, got ${enrichment.graphEdges.length}`);
if (enrichment._meta.hardExcluded !== 1) fail(`Expected 1 hard-excluded, got ${enrichment._meta.hardExcluded}`);
if (enrichment._meta.belowFloorDropped !== 1) fail(`Expected 1 below-floor, got ${enrichment._meta.belowFloorDropped}`);
if (enrichment._meta.ingested !== 2) fail(`Expected 2 ingested, got ${enrichment._meta.ingested}`);

for (const obs of enrichment.observations) {
  if (!obs._exploitScenario) fail(`Missing _exploitScenario on ${obs.observationId}`);
  if (!obs._attackTechnique) fail(`Missing _attackTechnique on ${obs.observationId}`);
  if (obs.confidence < 0.7) fail(`Observation confidence below floor: ${obs.confidence}`);
}

for (const receipt of enrichment.receipts) {
  if (receipt.liveConnectionUsed !== false) fail('Receipt liveConnectionUsed must be false');
  if (receipt.executionPerformed !== false) fail('Receipt executionPerformed must be false');
  if (receipt.mode !== 'fixture') fail('Receipt mode must be fixture');
  if (!receipt.evidenceHash.startsWith('sha256:')) fail('Receipt evidenceHash must be sha256:...');
}

for (const edge of enrichment.graphEdges) {
  if (edge.predicate !== 'should_generate_detection') fail(`Unexpected edge predicate: ${edge.predicate}`);
}

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('  ingest-code-findings integration tests passed.');
