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

function readJsonOptional(absPath) {
  if (!fs.existsSync(absPath)) return null;
  return readJson(absPath);
}

function readFirstJsonlOptional(absPath) {
  if (!fs.existsSync(absPath)) return null;
  const line = fs.readFileSync(absPath, 'utf8').split('\n').filter(Boolean)[0];
  if (!line) return null;
  return JSON.parse(line);
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

function optionalVerticalSliceTriples(runLocal, details) {
  const triples = [];
  const eventNode = `ex:${runLocal}-event-ir`;
  const identityNode = `ex:${runLocal}-identity-ir`;
  const proofNode = `ex:${runLocal}-proof-artifact`;

  if (details.eventIr) {
    triples.push([
      `${eventNode} a apt:EventIRRecord ;`,
      `  apt:eventId ${turtleString(details.eventIr.eventId)} ;`,
      `  apt:eventKind ${turtleString(details.eventIr.kind)} ;`,
      `  apt:safetyMode ${turtleString(details.eventIr.safetyClass)} ;`,
      `  apt:sourceSurface ${turtleString(details.eventIr.surface)} ;`,
      `  rdfs:label ${turtleString(`Event-IR ${details.eventIr.eventId}`)} .`,
    ].join('\n'));
  }

  if (details.identityIr) {
    const primeTypes = (details.identityIr.primes || []).map((prime) => prime.primeType).join(',');
    triples.push([
      `${identityNode} a apt:IdentityIRRecord ;`,
      `  apt:identityIrId ${turtleString(details.identityIr.identityIrId)} ;`,
      `  apt:subjectType ${turtleString(details.identityIr.subject.entityType)} ;`,
      `  apt:safetyMode ${turtleString(details.identityIr.safetyMode)} ;`,
      `  apt:primeTypes ${turtleString(primeTypes)} ;`,
      `  rdfs:label ${turtleString(`Identity-IR ${details.identityIr.identityIrId}`)} .`,
    ].join('\n'));
  }

  if (details.proofArtifact) {
    const proof = details.proofArtifact;
    const estimate = proof.configurationVolume && typeof proof.configurationVolume.estimate === 'number'
      ? proof.configurationVolume.estimate
      : 0;
    triples.push([
      `${proofNode} a apt:ProofArtifact ;`,
      `  apt:proofId ${turtleString(proof.proofId)} ;`,
      `  apt:claimType ${turtleString(proof.claim.claimType)} ;`,
      `  apt:claimStatus ${turtleString(proof.status)} ;`,
      `  apt:safetyMode ${turtleString(proof.safetyMode)} ;`,
      `  apt:dynamicMetricType ${turtleString(proof.dynamicMetric ? proof.dynamicMetric.metricType : 'not_reported')} ;`,
      `  apt:configurationVolumeClass ${turtleString(proof.configurationVolume ? proof.configurationVolume.volumeClass : 'unknown')} ;`,
      `  apt:configurationVolumeEstimate ${estimate} ;`,
      `  apt:archetypeFamily ${turtleString(proof.archetype ? proof.archetype.family : 'unknown')} ;`,
      `  rdfs:label ${turtleString(`Proof artifact ${proof.proofId}`)} .`,
    ].join('\n'));
  }

  if (details.eventIr && details.identityIr) {
    triples.push(`${identityNode} apt:derivedFromEvent ${eventNode} .`);
  }
  if (details.identityIr && details.proofArtifact) {
    triples.push(`${proofNode} apt:provesIdentityEvidence ${identityNode} .`);
  }
  if (details.eventIr && details.proofArtifact) {
    triples.push(`${proofNode} apt:provesEventEvidence ${eventNode} .`);
  }

  return triples.join('\n\n');
}

function renderTurtle(summary, details) {
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

  const verticalSliceTriples = optionalVerticalSliceTriples(runLocal, details);

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
    `  apt:syntheticEventCount ${summary.counts.syntheticEvents} ;`,
    `  apt:eventIrRecordCount ${summary.counts.eventIrRecords || 0} ;`,
    `  apt:identityIrRecordCount ${summary.counts.identityIrRecords || 0} ;`,
    `  apt:proofArtifactCount ${summary.counts.proofArtifacts || 0} ;`,
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
    verticalSliceTriples,
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

  const details = {
    eventIr: readFirstJsonlOptional(path.join(runAbs, 'event-ir.jsonl')),
    identityIr: readJsonOptional(path.join(runAbs, 'identity-ir.json')),
    proofArtifact: readJsonOptional(path.join(runAbs, 'proof-artifact.json')),
  };

  const ttl = renderTurtle(summary, details);
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
