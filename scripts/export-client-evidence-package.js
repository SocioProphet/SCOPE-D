#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const RUN_MANIFEST_SCHEMA = 'config/schemas/operator-run-manifest.schema.json';
const PACKAGE_SCHEMA = 'config/schemas/client-evidence-package.schema.json';

function usage() {
  console.log('Usage: node scripts/export-client-evidence-package.js <operator-run-manifest.json> [--out-dir <dir>]');
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
  if (!args.input) throw new Error('Missing operator run manifest path.');
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
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'package';
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function resolveArtifactPath(manifestDir, artifactPath) {
  const rootCandidate = abs(artifactPath);
  if (fs.existsSync(rootCandidate)) return rootCandidate;
  const manifestCandidate = path.join(manifestDir, artifactPath);
  if (fs.existsSync(manifestCandidate)) return manifestCandidate;
  throw new Error(`Missing source artifact: ${artifactPath}`);
}

function safePackagePath(artifact) {
  const ext = path.extname(artifact.path) || '.json';
  const base = `${slug(artifact.artifactId)}${ext}`;
  return path.join('artifacts', base);
}

function copyVerifiedArtifact(manifestDir, outDir, artifact) {
  const source = resolveArtifactPath(manifestDir, artifact.path);
  const bytes = fs.readFileSync(source);
  const digest = sha256(bytes);
  if (digest !== artifact.sha256) throw new Error(`Digest mismatch for ${artifact.artifactId}`);
  if (bytes.length !== artifact.byteLength) throw new Error(`Byte length mismatch for ${artifact.artifactId}`);
  const packageRel = safePackagePath(artifact);
  const destination = path.join(outDir, packageRel);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
  return {
    artifactId: artifact.artifactId,
    artifactType: artifact.artifactType,
    sourcePath: artifact.path,
    packagePath: packageRel.replace(/\\/g, '/'),
    sha256: digest,
    byteLength: bytes.length,
  };
}

function markdown(pkg) {
  const lines = [];
  lines.push(`# SCOPE-D Client Evidence Package: ${pkg.packageId}`);
  lines.push('');
  lines.push(`- Source run: ${pkg.sourceRunId}`);
  lines.push(`- Client: ${pkg.clientRef}`);
  lines.push(`- Mode: ${pkg.mode}`);
  lines.push(`- Artifacts: ${pkg.artifactCount}`);
  lines.push(`- Network access attempted: ${pkg.boundaryFlags.networkAccessAttempted}`);
  lines.push(`- Scan execution performed: ${pkg.boundaryFlags.scanExecutionPerformed}`);
  lines.push(`- Execution performed: ${pkg.boundaryFlags.executionPerformed}`);
  lines.push('');
  lines.push('## Artifacts');
  for (const artifact of pkg.artifacts) {
    lines.push(`- ${artifact.artifactId} (${artifact.artifactType}): ${artifact.packagePath} sha256=${artifact.sha256}`);
  }
  lines.push('');
  lines.push('## Non-Claims');
  for (const claim of pkg.nonClaims) lines.push(`- ${claim}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

try {
  const args = parseArgs(process.argv);
  const manifestPath = abs(args.input);
  const manifestDir = path.dirname(manifestPath);
  const manifest = readJson(manifestPath);
  validate(RUN_MANIFEST_SCHEMA, manifest, 'operator run manifest');

  const outDir = abs(args.outDir || path.join(manifestDir, 'client-evidence-package'));
  if (fs.existsSync(outDir)) throw new Error(`Output package directory already exists: ${rel(outDir)}`);
  fs.mkdirSync(outDir, { recursive: true });

  const artifacts = [];
  const ids = new Set();
  for (const artifact of manifest.artifacts) {
    if (ids.has(artifact.artifactId)) throw new Error(`Duplicate package artifact id: ${artifact.artifactId}`);
    ids.add(artifact.artifactId);
    artifacts.push(copyVerifiedArtifact(manifestDir, outDir, artifact));
  }

  const pkg = {
    schemaVersion: '0.1.0',
    packageId: `client-evidence-package:${slug(manifest.sourceRunId)}`,
    sourceManifestRef: rel(manifestPath),
    sourceRunId: manifest.sourceRunId,
    clientRef: manifest.clientRef,
    mode: manifest.mode,
    generatedAt: new Date().toISOString(),
    artifactCount: artifacts.length,
    artifacts,
    boundaryFlags: manifest.boundaryFlags,
    nonClaims: [
      'This package preserves evidence artifacts and hashes; it does not certify full security.',
      'This package does not authorize live action, credential access, payload delivery, mutation, or destructive behavior.',
      'This package is a client-facing evidence bundle derived from a SCOPE-D run manifest.'
    ],
  };

  validate(PACKAGE_SCHEMA, pkg, 'client evidence package');
  writeJson(path.join(outDir, 'client-evidence-package.json'), pkg);
  writeText(path.join(outDir, 'client-evidence-package.md'), markdown(pkg));
  process.stdout.write(`${JSON.stringify(pkg, null, 2)}\n`);
} catch (err) {
  console.error(`export-client-evidence-package failed: ${err.message}`);
  process.exit(1);
}
