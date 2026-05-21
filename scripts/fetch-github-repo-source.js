#!/usr/bin/env node
'use strict';

const https = require('https');

function parseArgs(argv) {
  const args = { repo: null, env: 'GITHUB_TOKEN' };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--repo') { args.repo = argv[++i]; continue; }
    if (item === '--token-env') { args.env = argv[++i]; continue; }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.repo || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(args.repo)) throw new Error('--repo owner/name is required');
  if (!/^[A-Z_][A-Z0-9_]*$/.test(args.env)) throw new Error('--token-env must be an environment variable name');
  return args;
}

function githubGet(pathName, token) {
  return new Promise((resolve, reject) => {
    const headers = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'scope-d-readonly-posture',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = https.request({ hostname: 'api.github.com', method: 'GET', path: pathName, headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode === 404) return resolve(null);
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`GET ${pathName} returned ${res.statusCode}`));
        try { resolve(body ? JSON.parse(body) : null); } catch (err) { reject(err); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const token = process.env[args.env] || '';
  const [owner, repo] = args.repo.split('/');
  const repoInfo = await githubGet(`/repos/${owner}/${repo}`, token);
  if (!repoInfo) throw new Error(`Repository not found: ${args.repo}`);
  process.stdout.write(`${JSON.stringify({ repo: repoInfo }, null, 2)}\n`);
}

main().catch((err) => {
  console.error(`fetch-github-repo-source failed: ${err.message}`);
  process.exit(1);
});
