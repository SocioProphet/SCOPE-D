#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_SCHEMA = 'config/schemas/github-posture-manifest.schema.json';
const ASSESSMENT_SCHEMA = 'config/schemas/github-posture-assessment.schema.json';

function usage() {
  console.log('Usage: node scripts/evaluate-github-posture.js <github-posture-manifest.json> [--out <assessment.json>]');
}

function readJson(relOrAbsPath) {
  const absPath = path.isAbsolute(relOrAbsPath) ? relOrAbsPath : path.join(ROOT, relOrAbsPath);
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}

function writeJson(relOrAbsPath, value) {
  const absPath = path.isAbsolute(relOrAbsPath) ? relOrAbsPath : path.join(ROOT, relOrAbsPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function validateWithSchema(schemaRelPath, value, label) {
  const schema = readJson(schemaRelPath);
  const ajv = createAjv();
  const validate = ajv.compile(schema);
  if (!validate(value)) {
    const details = (validate.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
    throw new Error(`${label} failed schema validation: ${details}`);
  }
}

function parseArgs(argv) {
  const args = { input: null, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') {
      usage();
      process.exit(0);
    }
    if (item === '--out') {
      args.out = argv[i + 1];
      i += 1;
      continue;
    }
    if (!args.input) {
      args.input = item;
      continue;
    }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.input) throw new Error('Missing GitHub posture manifest path.');
  return args;
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'repo';
}

function finding(id, category, severity, evidence, recommendation) {
  return { id, category, severity, evidence, recommendation };
}

function scoreSeverity(severity) {
  if (severity === 'critical') return 30;
  if (severity === 'high') return 20;
  if (severity === 'medium') return 10;
  if (severity === 'low') return 5;
  return 0;
}

function riskLevel(score) {
  if (score >= 70) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 15) return 'medium';
  return 'low';
}

function assess(manifest, manifestRef) {
  const repoSlug = slug(manifest.repoFullName.replace('/', '-'));
  const findings = [];

  if (!manifest.branchProtection.requiredReviews) {
    findings.push(finding(
      `finding:${repoSlug}:branch-reviews-missing`,
      'branch_protection',
      'medium',
      { requiredReviews: false },
      'Require pull request reviews on the default branch.'
    ));
  }

  if (!manifest.branchProtection.requiredStatusChecks) {
    findings.push(finding(
      `finding:${repoSlug}:status-checks-missing`,
      'branch_protection',
      'high',
      { requiredStatusChecks: false },
      'Require status checks before merging to the default branch.'
    ));
  }

  if (!manifest.branchProtection.enforceAdmins) {
    findings.push(finding(
      `finding:${repoSlug}:admin-enforcement-missing`,
      'branch_protection',
      'low',
      { enforceAdmins: false },
      'Enable branch protection enforcement for administrators or record an approved exception.'
    ));
  }

  if (manifest.actions.defaultWorkflowPermissions === 'write') {
    findings.push(finding(
      `finding:${repoSlug}:workflow-write-default`,
      'workflow_permissions',
      'high',
      { defaultWorkflowPermissions: 'write' },
      'Set default GitHub Actions token permissions to read-only and grant write permissions per workflow only when justified.'
    ));
  }

  if (manifest.actions.allowMarketplaceActions) {
    findings.push(finding(
      `finding:${repoSlug}:marketplace-actions-unrestricted`,
      'workflow_permissions',
      'medium',
      { allowMarketplaceActions: true },
      'Restrict GitHub Actions to approved action sources or pin third-party actions by SHA.'
    ));
  }

  if (!manifest.codeowners.present) {
    findings.push(finding(
      `finding:${repoSlug}:codeowners-missing`,
      'code_ownership',
      'medium',
      { codeownersPresent: false },
      'Add CODEOWNERS for security-critical paths and require review by owners.'
    ));
  }

  if (!manifest.secretScanning.enabled || !manifest.secretScanning.pushProtection) {
    findings.push(finding(
      `finding:${repoSlug}:secret-scanning-incomplete`,
      'secret_scanning',
      'medium',
      manifest.secretScanning,
      'Enable secret scanning and push protection where available.'
    ));
  }

  if (!manifest.dependencyReview.enabled) {
    findings.push(finding(
      `finding:${repoSlug}:dependency-review-missing`,
      'dependency_review',
      'low',
      { dependencyReview: false },
      'Enable dependency review or equivalent dependency-change approval gates.'
    ));
  }

  for (const env of manifest.environments || []) {
    if (!env.requiredReviewers) {
      findings.push(finding(
        `finding:${repoSlug}:environment-${slug(env.name)}-reviewers-missing`,
        'environment_protection',
        'medium',
        env,
        `Require reviewers for environment ${env.name}.`
      ));
    }
  }

  const riskScore = Math.min(100, findings.reduce((sum, item) => sum + scoreSeverity(item.severity), 0));
  const recommendedControls = Array.from(new Set(findings.map((item) => item.recommendation)));

  return {
    schemaVersion: '0.1.0',
    assessmentId: `github-posture-assessment:${repoSlug}`,
    manifestRef,
    repoFullName: manifest.repoFullName,
    collectionMode: manifest.collectionMode,
    riskScore,
    riskLevel: riskLevel(riskScore),
    findings,
    recommendedControls,
    redactionState: manifest.redactionState,
    liveApiUsed: manifest.liveApiUsed,
    liveExecutionPerformed: false,
  };
}

function main() {
  const args = parseArgs(process.argv);
  const manifest = readJson(args.input);
  validateWithSchema(MANIFEST_SCHEMA, manifest, 'GitHub posture manifest');

  if (manifest.liveApiUsed !== false || manifest.collectionMode !== 'fixture') {
    throw new Error('This evaluator slice is fixture/read-only only. Live GitHub API collection is not enabled in this PR.');
  }

  const assessment = assess(manifest, args.input);
  validateWithSchema(ASSESSMENT_SCHEMA, assessment, 'GitHub posture assessment');

  if (args.out) writeJson(args.out, assessment);
  process.stdout.write(`${JSON.stringify(assessment, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  console.error(`evaluate-github-posture failed: ${err.message}`);
  process.exit(1);
}
