#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FETCHER = path.join(ROOT, 'scripts', 'fetch-github-repo-source.js');

function run(args) {
  return cp.spawnSync(process.execPath, [FETCHER, ...args], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
}

function fail(message, result) {
  console.error(message);
  if (result && result.stderr) console.error(result.stderr.trim());
  process.exit(1);
}

const missing = run([]);
if (missing.status === 0) fail('Expected missing repo argument to fail.', missing);

const bad = run(['--repo', 'bad']);
if (bad.status === 0) fail('Expected malformed repo argument to fail.', bad);

console.log('GitHub source fetcher basic tests passed.');
