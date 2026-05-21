#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const SURFACE_SCHEMA = 'config/schemas/mcp-surface-manifest.schema.json';
const ASSESSMENT_SCHEMA = 'config/schemas/mcp-surface-assessment.schema.json';
const RISK_SCHEMA = 'config/schemas/mcp-tool-risk.schema.json';

function usage() {
  console.log('Usage: node scripts/evaluate-mcp-surface.js <mcp-surface-manifest.json> [--out-dir <dir>]');
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
  if (!args.input) throw new Error('Missing MCP surface manifest path.');
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

function createAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function validate(schemaPath, value, label) {
  const schema = readJson(schemaPath);
  const validateFn = createAjv().compile(schema);
  if (!validateFn(value)) {
    const details = (validateFn.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
    throw new Error(`${label} failed schema validation: ${details}`);
  }
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'mcp';
}

function severityScore(severity) {
  return { critical: 30, high: 20, medium: 10, low: 5, informational: 0 }[severity] || 0;
}

function riskLevel(score) {
  if (score >= 70) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 15) return 'medium';
  return 'low';
}

function finding(toolName, category, severity, evidence, recommendation) {
  return {
    id: `finding:${slug(toolName)}:${category}`,
    toolName,
    category,
    severity,
    evidence,
    recommendation,
  };
}

function classifyTool(serverRef, tool) {
  const permissions = tool.permissions || [];
  const hints = tool.riskHints || [];
  const findings = [];
  const allowsExtraArgs = Boolean(tool.argumentSchema && tool.argumentSchema.additionalProperties === true);
  const description = String(tool.description || '').toLowerCase();

  if (permissions.includes('command.exec')) {
    findings.push(finding(tool.toolName, 'command_execution', 'critical', { permissions }, 'Block command execution tools unless a separate signed live-engagement policy explicitly authorizes them.'));
  }

  if (permissions.includes('filesystem.write')) {
    findings.push(finding(tool.toolName, 'filesystem_exposure', 'high', { permissions }, 'Separate filesystem write access from analysis tools and require write gates.'));
  } else if (permissions.includes('filesystem.read')) {
    findings.push(finding(tool.toolName, 'filesystem_exposure', 'medium', { permissions }, 'Restrict filesystem reads to allowlisted paths and redact file content by default.'));
  }

  if (permissions.includes('network.fetch')) {
    findings.push(finding(tool.toolName, 'network_exposure', 'medium', { permissions }, 'Constrain network fetch tools by domain allowlist, method allowlist, and egress policy.'));
  }

  if (permissions.includes('memory.read') && permissions.includes('network.fetch')) {
    findings.push(finding(tool.toolName, 'overbroad_tool', 'high', { permissions }, 'Split memory access from network fetch capability or require a combined-capability policy gate.'));
  }

  if (allowsExtraArgs) {
    findings.push(finding(tool.toolName, 'unsafe_arguments', 'medium', { additionalProperties: true }, 'Set additionalProperties=false and validate every tool argument.'));
  }

  if (description.includes('ignore prior instructions') || hints.includes('hidden_instruction_channel')) {
    findings.push(finding(tool.toolName, 'hidden_instruction_channel', 'high', { description: tool.description, riskHints: hints }, 'Remove instruction-conflict language from tool descriptions and isolate policy from tool prompts.'));
  }

  if (hints.includes('ambiguous_description')) {
    findings.push(finding(tool.toolName, 'ambiguous_description', 'low', { description: tool.description }, 'Rewrite the description as a narrow operation contract with explicit non-goals.'));
  }

  return findings.map((item) => ({
    finding: item,
    risk: {
      schemaVersion: '0.1.0',
      id: `mcp-risk-${slug(tool.toolName)}-${item.category}`,
      serverRef,
      toolName: tool.toolName,
      riskCategory: item.category,
      severity: item.severity,
      confidence: 'high',
      evidence: item.evidence,
      recommendedBoundary: item.recommendation,
      policyGateRequired: ['critical', 'high', 'medium'].includes(item.severity),
      countermeasureRefs: [`countermeasure:${item.category}`],
    },
  }));
}

function assess(manifest, manifestRef) {
  const paired = manifest.tools.flatMap((tool) => classifyTool(manifest.serverRef, tool));
  const findings = paired.map((item) => item.finding);
  const risks = paired.map((item) => item.risk);
  const baseAuthRisk = manifest.auth && manifest.auth.required === false ? 10 : 0;
  if (baseAuthRisk > 0) {
    findings.push(finding('server', 'missing_auth', 'medium', manifest.auth, 'Require authentication for MCP servers before any non-lab use.'));
    risks.push({
      schemaVersion: '0.1.0',
      id: `mcp-risk-${slug(manifest.serverName)}-missing-auth`,
      serverRef: manifest.serverRef,
      toolName: 'server',
      riskCategory: 'missing_auth',
      severity: 'medium',
      confidence: 'high',
      evidence: manifest.auth,
      recommendedBoundary: 'Require authentication and scoped tokens for MCP server access.',
      policyGateRequired: true,
      countermeasureRefs: ['countermeasure:mcp-auth-required'],
    });
  }

  const score = Math.min(100, risks.reduce((sum, risk) => sum + severityScore(risk.severity), 0));
  return {
    assessment: {
      schemaVersion: '0.1.0',
      assessmentId: `mcp-surface-assessment:${slug(manifest.serverName)}`,
      manifestRef,
      serverRef: manifest.serverRef,
      serverName: manifest.serverName,
      environment: manifest.environment,
      riskScore: score,
      riskLevel: riskLevel(score),
      toolCount: manifest.tools.length,
      riskRefs: risks.map((risk) => risk.id),
      findings,
      recommendedControls: Array.from(new Set(findings.map((item) => item.recommendation))),
      redactionState: manifest.redactionState,
      liveConnectionUsed: false,
      liveExecutionPerformed: false,
    },
    risks,
  };
}

try {
  const args = parseArgs(process.argv);
  const manifest = readJson(args.input);
  validate(SURFACE_SCHEMA, manifest, 'MCP surface manifest');
  if (manifest.liveConnectionUsed !== false) throw new Error('MCP surface evaluator does not accept liveConnectionUsed=true.');
  const result = assess(manifest, args.input);
  validate(ASSESSMENT_SCHEMA, result.assessment, 'MCP surface assessment');
  for (const risk of result.risks) validate(RISK_SCHEMA, risk, `MCP tool risk ${risk.id}`);
  if (args.outDir) {
    writeJson(path.join(args.outDir, 'mcp-surface-assessment.json'), result.assessment);
    writeJson(path.join(args.outDir, 'mcp-tool-risks.json'), result.risks);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (err) {
  console.error(`evaluate-mcp-surface failed: ${err.message}`);
  process.exit(1);
}
