#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const DISCOVERY_SCHEMA = 'config/schemas/mcp-discovery-source.schema.json';
const ALLOWED_METHOD = 'tools/list';

function usage() {
  console.log('Usage: node scripts/discover-mcp-tools.js --server-ref <ref> --server-name <name> [--mock-response <path> | --endpoint <http-url>] [--out <source.json>]');
}

function parseArgs(argv) {
  const args = {
    serverRef: null,
    serverName: null,
    environment: 'unknown',
    transport: 'http',
    authRequired: false,
    authMethod: 'none',
    mockResponse: null,
    endpoint: null,
    out: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--help' || item === '-h') { usage(); process.exit(0); }
    if (item === '--server-ref') { args.serverRef = argv[++i]; continue; }
    if (item === '--server-name') { args.serverName = argv[++i]; continue; }
    if (item === '--environment') { args.environment = argv[++i]; continue; }
    if (item === '--transport') { args.transport = argv[++i]; continue; }
    if (item === '--auth-required') { args.authRequired = true; continue; }
    if (item === '--auth-method') { args.authMethod = argv[++i]; continue; }
    if (item === '--mock-response') { args.mockResponse = argv[++i]; continue; }
    if (item === '--endpoint') { args.endpoint = argv[++i]; continue; }
    if (item === '--out') { args.out = argv[++i]; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.serverRef) throw new Error('--server-ref is required.');
  if (!args.serverName) throw new Error('--server-name is required.');
  if (args.mockResponse && args.endpoint) throw new Error('Use either --mock-response or --endpoint, not both.');
  if (!args.mockResponse && !args.endpoint) throw new Error('One of --mock-response or --endpoint is required.');
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

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'mcp-discovery';
}

function postJson(endpoint, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(endpoint);
    if (!['http:', 'https:'].includes(parsed.protocol)) return reject(new Error('Endpoint must be http or https.'));
    const data = Buffer.from(JSON.stringify(body));
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      method: 'POST',
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      path: `${parsed.pathname}${parsed.search}`,
      headers: {
        'content-type': 'application/json',
        'content-length': data.length,
        'user-agent': 'scope-d-mcp-discovery-readonly',
      },
    }, (res) => {
      let response = '';
      res.on('data', (chunk) => { response += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`MCP discovery endpoint returned ${res.statusCode}`));
        try { resolve(JSON.parse(response)); } catch (err) { reject(err); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function inferPermissions(tool) {
  const text = `${tool.name || ''} ${tool.description || ''}`.toLowerCase();
  const permissions = new Set(Array.isArray(tool.permissions) ? tool.permissions : []);
  if (text.includes('fetch') || text.includes('url') || text.includes('http')) permissions.add('network.fetch');
  if (text.includes('file') || text.includes('workspace')) permissions.add('filesystem.read');
  if (text.includes('command') || text.includes('shell')) permissions.add('command.exec');
  return Array.from(permissions);
}

function normalizeToolsList(response, args, liveConnectionUsed) {
  if (!response || response.jsonrpc !== '2.0') throw new Error('Expected JSON-RPC 2.0 response.');
  if (response.error) throw new Error(`MCP discovery returned error: ${JSON.stringify(response.error)}`);
  const tools = response.result && Array.isArray(response.result.tools) ? response.result.tools : null;
  if (!tools) throw new Error('Expected result.tools array.');

  return {
    schemaVersion: '0.1.0',
    sourceId: `mcp-discovery-source:${slug(args.serverName)}`,
    serverRef: args.serverRef,
    serverName: args.serverName,
    environment: args.environment,
    transport: args.transport,
    auth: { required: args.authRequired, method: args.authMethod },
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || { type: 'object', additionalProperties: true },
      annotations: tool.annotations || {},
      permissions: inferPermissions(tool),
    })),
    redactionState: liveConnectionUsed ? 'redacted' : 'synthetic',
    liveConnectionUsed,
    toolExecutionPerformed: false,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const request = { jsonrpc: '2.0', id: 'scope-d-tools-list', method: ALLOWED_METHOD, params: {} };
  const response = args.mockResponse ? readJson(args.mockResponse) : await postJson(args.endpoint, request);
  const source = normalizeToolsList(response, args, Boolean(args.endpoint));
  validate(DISCOVERY_SCHEMA, source, 'MCP discovery source');
  if (args.out) writeJson(args.out, source);
  process.stdout.write(`${JSON.stringify(source, null, 2)}\n`);
}

main().catch((err) => {
  console.error(`discover-mcp-tools failed: ${err.message}`);
  process.exit(1);
});
