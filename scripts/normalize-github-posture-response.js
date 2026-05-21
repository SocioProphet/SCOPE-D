#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_SCHEMA = 'config/schemas/github-posture-manifest.schema.json';

function usage() {
  console.log('Usage: node scripts/normalize-github-posture-response.js <mock-response.json> --repo <owner/name> [--mode fixture|live_read_only] [--out <manifest.json>]');
}

function parseArgs(argv) {
  const args = { input: null, repo: null, mode: 'fixture', out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--repo') { args.repo = argv[++i]; continue; }
    if (item === '--mode') { args.mode = argv[++i]; continue; }
    if (item === '--out') { args.out = argv[++i]; continue; }
    if (!args.input) { args.input = item; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.input) throw new Error('Missing response path.');
  if (!args.repo) throw new Error('--repo is required.');
  if (!['fixture', 'live_read_only'].includes(args.mode)) throw new Error('--mode must be fixture or live_read_only.');
  return args;
}

function abs(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT, file);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(abs(file), 'utf8'));
}

function writeJson(file, value) {
  const out = abs(file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function validate(schemaPath, value, label) {
  const schema = readJson(schemaPath);
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validator = ajv.compile(schema);
  if (!validator(value)) {
    const details = (validator.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
    throw new Error(`${label} failed schema validation: ${details}`);
  }
}

function normalizeActions(data) {
  if (!data) return { enabled: false, defaultWorkflowPermissions: 'unknown', allowGitHubOwnedActions: false, allowMarketplaceActions: false };
  return {
    enabled: data.enabled !== false,
    defaultWorkflowPermissions: data.default_workflow_permissions || 'unknown',
    allowGitHubOwnedActions: data.allowed_actions !== 'none',
    allowMarketplaceActions: data.allowed_actions === 'all',
  };
}

function isEnabled(value) {
  if (value === true || value === 'enabled') return true;
  if (value === false || value === 'disabled' || value == null) return false;
  if (typeof value === 'object') return value.status === 'enabled' || value.enabled === true;
  return false;
}

function normalizeSecurity(source, repo) {
  const repoSecurity = repo.security_and_analysis || {};
  const explicit = source.securityFeatures || {};
  return {
    enabled: isEnabled(explicit.secretScanning || repoSecurity.secret_scanning),
    pushProtection: isEnabled(explicit.pushProtection || repoSecurity.secret_scanning_push_protection),
  };
}

function normalize(repoFullName, source, mode) {
  const repo = source.repo || {};
  const protection = source.branchProtection || null;
  const environments = Array.isArray(source.environments) ? source.environments : [];
  return {
    schemaVersion: '0.1.0',
    manifestId: `github-posture-manifest:${repoFullName.toLowerCase().replace(/[^a-z0-9._:-]+/g, '-')}`,
    collectionMode: mode,
    repoFullName,
    defaultBranch: repo.default_branch || 'main',
    visibility: repo.visibility || (repo.private ? 'private' : 'public'),
    branchProtection: {
      requiredReviews: Boolean(protection && protection.required_pull_request_reviews),
      requiredStatusChecks: Boolean(protection && protection.required_status_checks),
      enforceAdmins: Boolean(protection && protection.enforce_admins && protection.enforce_admins.enabled),
      allowsForcePushes: Boolean(protection && protection.allow_force_pushes && protection.allow_force_pushes.enabled),
      allowsDeletions: Boolean(protection && protection.allow_deletions && protection.allow_deletions.enabled),
    },
    actions: normalizeActions(source.actionsPermissions),
    codeowners: { present: Boolean(source.codeownersPresent) },
    secretScanning: normalizeSecurity(source, repo),
    dependencyReview: { enabled: Boolean(source.dependencyReviewEnabled) },
    environments: environments.map((env) => ({ name: env.name, requiredReviewers: Boolean(env.requiredReviewers) })),
    redactionState: mode === 'fixture' ? 'synthetic' : 'redacted',
    liveApiUsed: mode === 'live_read_only',
  };
}

try {
  const args = parseArgs(process.argv);
  const response = readJson(args.input);
  const manifest = normalize(args.repo, response, args.mode);
  validate(MANIFEST_SCHEMA, manifest, 'GitHub posture manifest');
  if (args.out) writeJson(args.out, manifest);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
} catch (err) {
  console.error(`normalize-github-posture-response failed: ${err.message}`);
  process.exit(1);
}
