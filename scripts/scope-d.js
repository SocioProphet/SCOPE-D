#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const DEFAULTS = {
  request: 'examples/scope-d/operator-scan-request.example.json',
  policy: 'examples/scope-d/operator-scan-policy.example.json',
  source: 'fixtures/synthetic/operator-local-passive-scan-source.web-endpoint.synthetic.json',
  redactionProfile: 'examples/scope-d/redaction-profile.client-safe.example.json',
  client: 'client:scope-d-demo',
};

function usage() {
  console.log([
    'SCOPE-D operator CLI',
    '',
    'Usage:',
    '  node scripts/scope-d.js <command> [options]',
    '',
    'Commands:',
    '  scan:assurance     Run scan assurance workflow',
    '  evidence:manifest  Generate run manifest with artifact hashes',
    '  evidence:package   Export client evidence package from manifest',
    '  evidence:redact    Redact a client evidence package',
    '  demo:scan          Run full synthetic scan-to-redacted-package demo',
    '',
    'Common demo:',
    '  node scripts/scope-d.js demo:scan --out-dir runs/demo-scope-d',
    '',
    'Boundaries:',
    '  Default demo uses local_passive evidence only.',
    '  live_readonly requires the underlying runner gates.',
    '  Credential access, payload delivery, mutation, and destructive behavior are not implemented by this CLI.',
  ].join('\n'));
}

function parseOptions(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) {
      opts._.push(item);
      continue;
    }
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      opts[key] = true;
      continue;
    }
    opts[key] = next;
    i += 1;
  }
  return opts;
}

function abs(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT, file);
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function ensureFreshDir(dir) {
  const target = abs(dir);
  if (fs.existsSync(target)) throw new Error(`Output directory already exists: ${rel(target)}`);
  fs.mkdirSync(target, { recursive: true });
  return target;
}

function runNode(label, script, args) {
  const command = [process.execPath, path.join(ROOT, script), ...args];
  const result = cp.spawnSync(command[0], command.slice(1), {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with status ${result.status}: ${result.stderr || result.stdout}`);
  }
  return result.stdout ? JSON.parse(result.stdout) : null;
}

function printResult(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function commandScanAssurance(opts) {
  const args = [
    '--request', abs(opts.request || DEFAULTS.request),
    '--policy', abs(opts.policy || DEFAULTS.policy),
    '--source', abs(opts.source || DEFAULTS.source),
    '--client', opts.client || DEFAULTS.client,
    '--mode', opts.mode || 'local_passive',
  ];
  if (opts.gate) args.push('--gate', abs(opts.gate));
  if (opts['execution-policy']) args.push('--execution-policy', abs(opts['execution-policy']));
  if (opts['egress-audit-dir']) args.push('--egress-audit-dir', opts['egress-audit-dir']);
  if (opts['run-id']) args.push('--run-id', opts['run-id']);
  if (opts['out-dir']) args.push('--out-dir', abs(opts['out-dir']));
  return runNode('scan assurance', 'scripts/run-scan-assurance.js', args);
}

function commandManifest(opts) {
  const sourceRun = opts.run || opts._[0];
  if (!sourceRun) throw new Error('evidence:manifest requires --run <operator-scan-assurance-run.json>.');
  const args = [abs(sourceRun)];
  if (opts.out) args.push('--out', abs(opts.out));
  return runNode('run manifest', 'scripts/generate-run-manifest.js', args);
}

function commandPackage(opts) {
  const manifest = opts.manifest || opts._[0];
  if (!manifest) throw new Error('evidence:package requires --manifest <operator-run-manifest.json>.');
  const args = [abs(manifest)];
  if (opts['out-dir']) args.push('--out-dir', abs(opts['out-dir']));
  return runNode('client evidence package', 'scripts/export-client-evidence-package.js', args);
}

function commandRedact(opts) {
  const packagePath = opts.package || opts._[0];
  if (!packagePath) throw new Error('evidence:redact requires --package <client-evidence-package.json>.');
  const profile = opts.profile || DEFAULTS.redactionProfile;
  const args = ['--package', abs(packagePath), '--profile', abs(profile)];
  if (opts['out-dir']) args.push('--out-dir', abs(opts['out-dir']));
  return runNode('redacted evidence package', 'scripts/redact-client-evidence.js', args);
}

function commandDemoScan(opts) {
  const outDir = ensureFreshDir(opts['out-dir'] || 'runs/scope-d-product-demo');
  const runDir = path.join(outDir, 'run');
  const packageDir = path.join(outDir, 'client-evidence-package');
  const redactedDir = path.join(outDir, 'redacted-client-evidence-package');
  const client = opts.client || DEFAULTS.client;
  const runId = opts['run-id'] || 'operator-scan-assurance-run:scope-d-product-demo';

  const assurance = commandScanAssurance({
    request: opts.request || DEFAULTS.request,
    policy: opts.policy || DEFAULTS.policy,
    source: opts.source || DEFAULTS.source,
    client,
    mode: opts.mode || 'local_passive',
    gate: opts.gate,
    'execution-policy': opts['execution-policy'],
    'egress-audit-dir': opts['egress-audit-dir'],
    'run-id': runId,
    'out-dir': runDir,
  });

  const manifestPath = path.join(runDir, 'operator-run-manifest.json');
  const manifest = commandManifest({
    run: path.join(runDir, 'operator-scan-assurance-run.json'),
    out: manifestPath,
    _: [],
  });

  const pkg = commandPackage({
    manifest: manifestPath,
    'out-dir': packageDir,
    _: [],
  });

  const redacted = commandRedact({
    package: path.join(packageDir, 'client-evidence-package.json'),
    profile: opts.profile || DEFAULTS.redactionProfile,
    'out-dir': redactedDir,
    _: [],
  });

  return {
    product: 'scope-d-demo-scan',
    status: 'complete',
    clientRef: client,
    outputDir: rel(outDir),
    assuranceRunRef: rel(path.join(runDir, 'operator-scan-assurance-run.json')),
    runManifestRef: rel(manifestPath),
    clientEvidencePackageRef: rel(path.join(packageDir, 'client-evidence-package.json')),
    redactedEvidencePackageRef: rel(path.join(redactedDir, 'redacted-evidence-package.json')),
    boundaryFlags: redacted.boundaryFlags || pkg.boundaryFlags || manifest.boundaryFlags || assurance.boundaryFlags,
  };
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') {
    usage();
    return;
  }
  const opts = parseOptions(rest);
  let result;
  if (command === 'scan:assurance') result = commandScanAssurance(opts);
  else if (command === 'evidence:manifest') result = commandManifest(opts);
  else if (command === 'evidence:package') result = commandPackage(opts);
  else if (command === 'evidence:redact') result = commandRedact(opts);
  else if (command === 'demo:scan') result = commandDemoScan(opts);
  else throw new Error(`Unknown command: ${command}`);
  printResult(result);
}

try {
  main();
} catch (err) {
  console.error(`scope-d failed: ${err.message}`);
  process.exit(1);
}
