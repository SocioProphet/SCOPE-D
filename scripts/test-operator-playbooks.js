#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA = path.join(ROOT, 'config', 'schemas', 'operator-playbook.schema.json');
const DIR = path.join(ROOT, 'playbooks');
const REQUIRED = [
  'mcp-tool-boundary-hardening.json',
  'ai-runtime-exposure-hardening.json',
  'k8s-workload-hardening.json',
  'github-repo-posture-hardening.json',
  'cross-surface-agent-runtime-hardening.json',
  'scan-result-response.json',
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(readJson(SCHEMA));
const ids = new Set();
const surfaces = new Set();

for (const filename of REQUIRED) {
  const file = path.join(DIR, filename);
  if (!fs.existsSync(file)) fail(`Missing ${filename}`);
  const playbook = readJson(file);
  if (!validate(playbook)) fail(`${filename} failed playbook schema validation`);
  if (ids.has(playbook.playbookId)) fail(`Duplicate playbook id ${playbook.playbookId}`);
  ids.add(playbook.playbookId);
  if (playbook.executionAllowed !== false) fail(`${filename} must not allow execution`);
  if (!Array.isArray(playbook.operatorSteps) || playbook.operatorSteps.length === 0) fail(`${filename} must include operator steps`);
  for (const step of playbook.operatorSteps) {
    if (step.executionAllowed !== false) fail(`${filename} step ${step.stepId} must not allow execution`);
  }
  for (const surface of playbook.surfaceKinds) surfaces.add(surface);
}

for (const expected of ['mcp_surface', 'mcp_discovery', 'ai_runtime', 'k8s_manifest', 'github_posture', 'network_boundary', 'web_endpoint', 'cross_surface']) {
  if (!surfaces.has(expected)) fail(`Missing surface coverage ${expected}`);
}

console.log('Operator playbook catalog tests passed.');
