#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const DISCOVERY_SCHEMA = 'config/schemas/mcp-discovery-source.schema.json';
const SURFACE_SCHEMA = 'config/schemas/mcp-surface-manifest.schema.json';

function usage() {
  console.log('Usage: node scripts/normalize-mcp-discovery.js <mcp-discovery-source.json> [--out <mcp-surface-manifest.json>]');
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
  if (!args.input) throw new Error('Missing MCP discovery source path.');
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
  const validator = ajv.compile(readJson(schemaPath));
  if (!validator(value)) {
    const details = (validator.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
    throw new Error(`${label} failed schema validation: ${details}`);
  }
}

function riskHints(tool) {
  if (tool.annotations && Array.isArray(tool.annotations.riskHints)) return tool.annotations.riskHints;
  if (Array.isArray(tool.riskHints)) return tool.riskHints;
  return [];
}

function normalizeTool(tool) {
  return {
    toolName: tool.name,
    description: tool.description || '',
    permissions: Array.isArray(tool.permissions) ? tool.permissions : [],
    argumentSchema: tool.inputSchema || { type: 'object', additionalProperties: true },
    riskHints: riskHints(tool),
  };
}

function normalize(source) {
  return {
    schemaVersion: '0.1.0',
    manifestId: source.sourceId.replace(/^mcp-discovery-source:/, 'mcp-surface-manifest:'),
    serverRef: source.serverRef,
    serverName: source.serverName,
    environment: source.environment,
    transport: source.transport,
    auth: source.auth,
    tools: source.tools.map(normalizeTool),
    redactionState: source.redactionState,
    liveConnectionUsed: Boolean(source.liveConnectionUsed),
  };
}

try {
  const args = parseArgs(process.argv);
  const source = readJson(args.input);
  validate(DISCOVERY_SCHEMA, source, 'MCP discovery source');
  if (source.toolExecutionPerformed !== false) throw new Error('MCP discovery normalization refuses toolExecutionPerformed=true.');
  const manifest = normalize(source);
  validate(SURFACE_SCHEMA, manifest, 'MCP surface manifest');
  if (args.out) writeJson(args.out, manifest);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
} catch (err) {
  console.error(`normalize-mcp-discovery failed: ${err.message}`);
  process.exit(1);
}
