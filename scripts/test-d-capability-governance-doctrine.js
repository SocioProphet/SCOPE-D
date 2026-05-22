#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOC = path.join(ROOT, 'docs', 'doctrine', 'd-capability-governance.md');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const text = fs.readFileSync(DOC, 'utf8');

for (const capability of [
  'live_target_action',
  'network_access',
  'credential_access',
  'payload_delivery',
  'mutation',
  'destructive_behavior',
]) {
  if (!text.includes(capability)) fail(`Missing D capability class ${capability}`);
}

for (const level of ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8']) {
  if (!text.includes(`| ${level} |`)) fail(`Missing promotion ladder level ${level}`);
}

for (const phrase of [
  'No capability may skip levels.',
  'direct production mutation',
  'credential guessing',
  'exploit payloads',
  'destructive live testing',
  'policy, receipt, and negative-fixture coverage',
]) {
  if (!text.includes(phrase)) fail(`Missing doctrine phrase: ${phrase}`);
}

console.log('D capability governance doctrine tests passed.');
