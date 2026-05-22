#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const PACKAGE_SCHEMA = 'config/schemas/client-evidence-package.schema.json';
const PROFILE_SCHEMA = 'config/schemas/redaction-profile.schema.json';
const REDACTED_SCHEMA = 'config/schemas/redacted-evidence-package.schema.json';

function usage() {
  console.log('Usage: node scripts/redact-client-evidence.js --package <client-evidence-package.json> --profile <redaction-profile.json> [--out-dir <dir>]');
}

function parseArgs(argv) {
  const args = { packagePath: null, profile: null, outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--package') { args.packagePath = argv[++i]; continue; }
    if (item === '--profile') { args.profile = argv[++i]; continue; }
    if (item === '--out-dir') { args.outDir = argv[++i]; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.packagePath) throw new Error('--package is required.');
  if (!args.profile) throw new Error('--profile is required.');
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

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'redacted';
}

function replacementFor(profile, match, fallback) {
  const rule = profile.redactionRules.find((item) => item.match === match);
  return rule ? rule.replacement : fallback;
}

function redactText(text, profile) {
  let out = String(text);
  const replacements = {
    authorization_headers: replacementFor(profile, 'authorization_headers', '[REDACTED_AUTHORIZATION_HEADER]'),
    cookies: replacementFor(profile, 'cookies', '[REDACTED_COOKIE]'),
    tokens: replacementFor(profile, 'tokens', '[REDACTED_TOKEN]'),
    private_ips: replacementFor(profile, 'private_ips', '[REDACTED_PRIVATE_IP]'),
    internal_hostnames: replacementFor(profile, 'internal_hostnames', '[REDACTED_INTERNAL_HOSTNAME]'),
    raw_banners: replacementFor(profile, 'raw_banners', '[REDACTED_BANNER]'),
    secret_like_values: replacementFor(profile, 'secret_like_values', '[REDACTED_SECRET_LIKE_VALUE]'),
  };

  out = out.replace(/("?authorization"?\s*[:=]\s*")([^"\n]+)(")/gi, `$1${replacements.authorization_headers}$3`);
  out = out.replace(/("?cookie"?\s*[:=]\s*")([^"\n]+)(")/gi, `$1${replacements.cookies}$3`);
  out = out.replace(/(bearer\s+)[a-z0-9._~+/=-]{12,}/gi, `$1${replacements.tokens}`);
  out = out.replace(/(api[_-]?key|token|secret)(["'\s:=]+)([a-z0-9._~+/=-]{12,})/gi, `$1$2${replacements.secret_like_values}`);
  out = out.replace(/\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacements.private_ips);
  out = out.replace(/\b172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}\b/g, replacements.private_ips);
  out = out.replace(/\b192\.168\.\d{1,3}\.\d{1,3}\b/g, replacements.private_ips);
  out = out.replace(/\b[a-z0-9-]+\.(internal|local|corp|lan)\b/gi, replacements.internal_hostnames);
  out = out.replace(/("?banner"?\s*[:=]\s*")([^"\n]+)(")/gi, `$1${replacements.raw_banners}$3`);
  return out;
}

function resolvePackageArtifact(packageDir, packagePath) {
  const file = path.join(packageDir, packagePath);
  if (!fs.existsSync(file)) throw new Error(`Missing package artifact: ${packagePath}`);
  return file;
}

function safeOutputPath(artifact) {
  const ext = path.extname(artifact.packagePath) || '.json';
  return path.join('artifacts', `${slug(artifact.artifactId)}${ext}`);
}

function markdown(index) {
  const lines = [];
  lines.push(`# SCOPE-D Redacted Evidence Package: ${index.redactedPackageId}`);
  lines.push('');
  lines.push(`- Client: ${index.clientRef}`);
  lines.push(`- Source package: ${index.sourcePackageRef}`);
  lines.push(`- Redaction profile: ${index.redactionProfileRef}`);
  lines.push(`- Artifacts: ${index.artifactCount}`);
  lines.push(`- Withheld: ${index.withheldArtifacts.length}`);
  lines.push('');
  lines.push('## Redacted Artifacts');
  for (const artifact of index.artifacts) {
    lines.push(`- ${artifact.artifactId} (${artifact.artifactType}): ${artifact.redactedPackagePath} sha256=${artifact.sha256}`);
  }
  lines.push('');
  lines.push('## Withheld Artifacts');
  for (const artifact of index.withheldArtifacts) {
    lines.push(`- ${artifact.artifactId} (${artifact.artifactType}): ${artifact.reason}`);
  }
  lines.push('');
  lines.push('## Non-Claims');
  for (const claim of index.nonClaims) lines.push(`- ${claim}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

try {
  const args = parseArgs(process.argv);
  const packagePath = abs(args.packagePath);
  const packageDir = path.dirname(packagePath);
  const pkg = readJson(packagePath);
  const profile = readJson(args.profile);
  validate(PACKAGE_SCHEMA, pkg, 'client evidence package');
  validate(PROFILE_SCHEMA, profile, 'redaction profile');

  const outDir = abs(args.outDir || path.join(packageDir, 'redacted-client-evidence-package'));
  if (fs.existsSync(outDir)) throw new Error(`Output redaction directory already exists: ${rel(outDir)}`);
  fs.mkdirSync(outDir, { recursive: true });

  const withheldTypes = new Set(profile.withheldArtifactTypes || []);
  const artifacts = [];
  const withheldArtifacts = [];

  for (const artifact of pkg.artifacts) {
    if (withheldTypes.has(artifact.artifactType)) {
      withheldArtifacts.push({
        artifactId: artifact.artifactId,
        artifactType: artifact.artifactType,
        reason: `Withheld by ${profile.profileId}`,
      });
      continue;
    }

    const sourceFile = resolvePackageArtifact(packageDir, artifact.packagePath);
    const sourceBytes = fs.readFileSync(sourceFile);
    if (sha256(sourceBytes) !== artifact.sha256) throw new Error(`Source package digest mismatch for ${artifact.artifactId}`);
    const redactedText = redactText(sourceBytes.toString('utf8'), profile);
    const redactedBytes = Buffer.from(redactedText, 'utf8');
    const redactedRel = safeOutputPath(artifact);
    const redactedPath = path.join(outDir, redactedRel);
    fs.mkdirSync(path.dirname(redactedPath), { recursive: true });
    fs.writeFileSync(redactedPath, redactedBytes);
    artifacts.push({
      artifactId: artifact.artifactId,
      artifactType: artifact.artifactType,
      sourcePackagePath: artifact.packagePath,
      redactedPackagePath: redactedRel.replace(/\\/g, '/'),
      sha256: sha256(redactedBytes),
      byteLength: redactedBytes.length,
      redactionApplied: redactedText !== sourceBytes.toString('utf8'),
    });
  }

  const index = {
    schemaVersion: '0.1.0',
    redactedPackageId: `redacted-evidence-package:${slug(pkg.packageId.replace(/^client-evidence-package:/, ''))}`,
    sourcePackageRef: rel(packagePath),
    redactionProfileRef: rel(abs(args.profile)),
    clientRef: pkg.clientRef,
    generatedAt: new Date().toISOString(),
    artifactCount: artifacts.length,
    artifacts,
    withheldArtifacts,
    boundaryFlags: pkg.boundaryFlags,
    nonClaims: [
      'This package applies configured redaction rules but does not certify that all sensitive data is absent.',
      'This package preserves evidence structure while rewriting or withholding configured sensitive artifacts.',
      'This package does not authorize live action, credential access, payload delivery, mutation, or destructive behavior.'
    ],
  };

  validate(REDACTED_SCHEMA, index, 'redacted evidence package');
  writeJson(path.join(outDir, 'redacted-evidence-package.json'), index);
  writeText(path.join(outDir, 'redacted-evidence-package.md'), markdown(index));
  process.stdout.write(`${JSON.stringify(index, null, 2)}\n`);
} catch (err) {
  console.error(`redact-client-evidence failed: ${err.message}`);
  process.exit(1);
}
