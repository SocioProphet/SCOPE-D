#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function usage() {
  console.log(`Usage: npm run scope-d:export-ontogenesis -- <runs/<run-id>>\n\nVerifies and reports a SCOPE-D run, then exports an Ontogenesis-compatible RDF/Turtle graph to ontogenesis.ttl.`);
}

function runNodeScript(scriptName, args) {
  childProcess.execFileSync(process.execPath, [path.join(ROOT, 'scripts', scriptName), ...args], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}

function turtleString(value) {
  return JSON.stringify(String(value));
}

function localName(value) {
  return String(value)
    .replace(/^scope-d-/, '')
    .replace(/[^A-Za-z0-9_-]/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '') || 'unnamed';
}

function renderTurtle(summary) {
  const runLocal = localName(summary.runId);
  const run = `ex:${runLocal}-run`;
  const boundary = `ex:${runLocal}-safety-boundary`;
  const receipt = `ex:${runLocal}-receipt`;
  const runSummary = `ex:${runLocal}-summary`;
  const eventEvidence = `ex:${runLocal}-synthetic-event-evidence`;
  const action = `ex:${runLocal}-synthetic-validation-action`;
  const control = `ex:${runLocal}-countermeasure-placeholder`;

  const artifactTriples = summary.artifacts.map((artifact, idx) => {
    const artifactNode = `ex:${runLocal}-artifact-${idx + 1}`;
    return [
      `${artifactNode} a upper:InformationArtifact ;`,
      `  rdfs:label ${turtleString(artifact.path)} ;`,
      `  apt:sourceUrl ${turtleString(artifact.path)} ;`,
      `  apt:receiptHash ${turtleString(artifact.sha256)} .`,
    ].join('\n');
  }).join('\n\n');

  return [
    '@base <https://socioprophet.github.io/ontogenesis/> .',
    '@prefix ex:    <https://socioprophet.github.io/ontogenesis/examples/scope-d-export#> .',
    '@prefix apt:   <https://socioprophet.github.io/ontogenesis/domains/agentic-purple-team#> .',
    '@prefix mitre: <https://socioprophet.github.io/ontogenesis/alignments/mitre-attack#> .',
    '@prefix upper: <https://socioprophet.github.io/ontogenesis/upper#> .',
    '@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .',
    '@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .',
    '',
    `${run} a apt:ControlLoopRun ;`,
    `  apt:runId ${turtleString(summary.runId)} ;`,
    `  apt:hasSafetyBoundary ${boundary} ;`,
    `  apt:hasReceipt ${receipt} ;`,
    `  apt:hasSummary ${runSummary} ;`,
    `  rdfs:label ${turtleString(`SCOPE-D run ${summary.runId}`)} .`,
    '',
    `${boundary} a apt:SafetyBoundary ;`,
    `  apt:safetyMode ${turtleString(summary.safety.mode)} ;`,
    `  rdfs:label ${turtleString(`Safety boundary for ${summary.runId}`)} .`,
    '',
    `${receipt} a apt:RunReceipt ;`,
    `  apt:receiptHash ${turtleString(summary.receipt.receiptId)} ;`,
    `  rdfs:label ${turtleString(`Receipt for ${summary.runId}`)} .`,
    '',
    `${runSummary} a apt:RunSummary ;`,
    `  rdfs:label ${turtleString(`Verified summary for ${summary.runId}`)} .`,
    '',
    `${action} a apt:AtomicValidationAction ;`,
    '  apt:actionClass "synthetic_event" ;',
    `  apt:safetyMode ${turtleString(summary.safety.mode)} ;`,
    `  apt:validatesControl ${control} ;`,
    `  apt:producesEvidence ${eventEvidence} ;`,
    '  apt:mapsToTechnique mitre:ToolPoisoningEquivalent ;',
    `  rdfs:label ${turtleString(`Synthetic validation action for ${summary.runId}`)} .`,
    '',
    `${eventEvidence} a apt:EvidenceEnvelope ;`,
    `  rdfs:label ${turtleString(`Synthetic event evidence for ${summary.runId}`)} .`,
    '',
    `${control} a apt:CountermeasureRule ;`,
    '  apt:mapsToTechnique mitre:ToolPoisoningEquivalent ;',
    '  rdfs:label "Placeholder countermeasure for MCP tool boundary validation" .',
    '',
    artifactTriples,
    '',
  ].join('\n');
}

function main() {
  const runArg = process.argv[2];
  if (!runArg || runArg === '--help' || runArg === '-h') {
    usage();
    process.exit(runArg ? 0 : 1);
  }

  const runAbs = path.resolve(ROOT, runArg);
  const runRel = path.relative(ROOT, runAbs).replace(/\\/g, '/');
  if (!runRel.startsWith('runs/')) {
    throw new Error(`Run directory must be under runs/: ${runRel}`);
  }

  runNodeScript('report-run.js', [runRel]);

  const summary = readJson(path.join(runAbs, 'run-summary.json'));
  if (summary.verified !== true) {
    throw new Error('Refusing to export unverified run summary.');
  }

  const ttl = renderTurtle(summary);
  const outPath = path.join(runAbs, 'ontogenesis.ttl');
  fs.writeFileSync(outPath, ttl, 'utf8');
  console.log(`Wrote Ontogenesis RDF export: ${path.join(runRel, 'ontogenesis.ttl')}`);
}

try {
  main();
} catch (err) {
  console.error(`scope-d:export-ontogenesis failed: ${err.message}`);
  process.exit(1);
}
