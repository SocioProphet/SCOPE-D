#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_SCHEMA = 'config/schemas/ai-runtime-exposure-manifest.schema.json';
const ASSESSMENT_SCHEMA = 'config/schemas/ai-runtime-exposure-assessment.schema.json';

function usage() {
  console.log('Usage: node scripts/evaluate-ai-runtime-exposure.js <ai-runtime-exposure-manifest.json> [--out <assessment.json>]');
}

function parseArgs(argv) {
  const args = { input: null, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--out') { args.out = argv[++i]; continue; }
    if (!args.input) { args.input = item; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.input) throw new Error('Missing AI runtime exposure manifest path.');
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
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validateFn = ajv.compile(readJson(schemaPath));
  if (!validateFn(value)) {
    const details = (validateFn.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
    throw new Error(`${label} failed schema validation: ${details}`);
  }
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'ai-runtime';
}

function score(severity) {
  return { critical: 30, high: 20, medium: 10, low: 5, informational: 0 }[severity] || 0;
}

function riskLevel(total) {
  if (total >= 70) return 'critical';
  if (total >= 40) return 'high';
  if (total >= 15) return 'medium';
  return 'low';
}

function finding(runtimeSlug, category, severity, evidence, recommendation) {
  return {
    id: `finding:${runtimeSlug}:${category}`,
    category,
    severity,
    evidence,
    recommendation,
  };
}

function evaluate(manifest, manifestRef) {
  const runtimeSlug = slug(manifest.runtimeName);
  const findings = [];

  if (manifest.endpoint.exposure === 'public' || manifest.endpoint.network === 'internet') {
    findings.push(finding(runtimeSlug, 'public_endpoint', 'high', manifest.endpoint, 'Restrict AI runtime endpoints to private/internal networks or require explicit public-exposure approval.'));
  }

  if (manifest.endpoint.tenantIsolation === 'none') {
    findings.push(finding(runtimeSlug, 'tenant_isolation', 'high', manifest.endpoint, 'Add tenant isolation before sharing runtime infrastructure across users or customers.'));
  }

  if (!manifest.auth.required || manifest.auth.method === 'none') {
    findings.push(finding(runtimeSlug, 'missing_auth', 'critical', manifest.auth, 'Require runtime authentication before any non-lab deployment.'));
  }

  if (!manifest.auth.scopedTokens) {
    findings.push(finding(runtimeSlug, 'unscoped_tokens', 'medium', manifest.auth, 'Use scoped tokens with runtime, tool, and tenant boundaries.'));
  }

  for (const binding of manifest.toolBindings || []) {
    const permissions = binding.permissions || [];
    const severe = permissions.includes('command.exec') || permissions.includes('filesystem.write');
    const combined = permissions.includes('network.fetch') && permissions.includes('memory.read');
    if (severe || combined || binding.requiresPolicyGate === false) {
      findings.push(finding(
        runtimeSlug,
        'tool_binding',
        severe ? 'critical' : 'high',
        binding,
        'Require explicit policy gates for high-risk tool bindings and split combined network/memory or command/write capabilities.'
      ));
    }
  }

  for (const store of manifest.memoryStores || []) {
    if (store.containsSensitiveData || store.writeEnabled || store.crossTenantAccessible) {
      findings.push(finding(runtimeSlug, 'memory_exposure', store.crossTenantAccessible ? 'critical' : 'high', store, 'Constrain memory stores by tenant, disable unreviewed writes, and redact sensitive content.'));
    }
  }

  const boundary = manifest.promptBoundary;
  const weakBoundary = !boundary.systemPromptPinned || !boundary.toolInstructionIsolation || !boundary.retrievalContentDelimited || !boundary.outputSchemaEnforced;
  if (weakBoundary) {
    findings.push(finding(runtimeSlug, 'prompt_boundary', 'high', boundary, 'Pin system prompts, isolate tool instructions, delimit retrieved content, and enforce output schemas.'));
  }

  const logging = manifest.logging;
  if ((logging.storesPrompts || logging.storesToolOutputs) && !logging.redactionRequired) {
    findings.push(finding(runtimeSlug, 'logging_exposure', 'medium', logging, 'Require redaction for prompt and tool-output logs.'));
  }

  if (!manifest.rateLimit.enabled) {
    findings.push(finding(runtimeSlug, 'missing_rate_limit', 'medium', manifest.rateLimit, 'Enable runtime rate limits and abuse thresholds.'));
  }

  const riskScore = Math.min(100, findings.reduce((sum, item) => sum + score(item.severity), 0));
  return {
    schemaVersion: '0.1.0',
    assessmentId: `ai-runtime-exposure-assessment:${slug(manifest.runtimeName)}`,
    manifestRef,
    runtimeRef: manifest.runtimeRef,
    runtimeName: manifest.runtimeName,
    environment: manifest.environment,
    riskScore,
    riskLevel: riskLevel(riskScore),
    findings,
    recommendedControls: Array.from(new Set(findings.map((item) => item.recommendation))),
    redactionState: manifest.redactionState,
    liveConnectionUsed: false,
    promptExecutionPerformed: false,
  };
}

try {
  const args = parseArgs(process.argv);
  const manifest = readJson(args.input);
  validate(MANIFEST_SCHEMA, manifest, 'AI runtime exposure manifest');
  if (manifest.liveConnectionUsed !== false) throw new Error('Evaluator refuses liveConnectionUsed=true.');
  if (manifest.promptExecutionPerformed !== false) throw new Error('Evaluator refuses promptExecutionPerformed=true.');
  const assessment = evaluate(manifest, args.input);
  validate(ASSESSMENT_SCHEMA, assessment, 'AI runtime exposure assessment');
  if (args.out) writeJson(args.out, assessment);
  process.stdout.write(`${JSON.stringify(assessment, null, 2)}\n`);
} catch (err) {
  console.error(`evaluate-ai-runtime-exposure failed: ${err.message}`);
  process.exit(1);
}
