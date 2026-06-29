#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const path = require('path');

const RUNNER = path.join(__dirname, 'run-red-team-eval.js');

const result = cp.spawnSync(process.execPath, [RUNNER], {
  cwd: path.resolve(__dirname, '..'),
  encoding: 'utf8',
  stdio: 'pipe',
});

if (result.status !== 0) {
  console.error('run-red-team-eval.js failed:');
  if (result.stdout) console.error(result.stdout);
  if (result.stderr) console.error(result.stderr);
  process.exit(1);
}

if (result.stdout) process.stdout.write(result.stdout);
console.log('Red-team eval tests passed.');
