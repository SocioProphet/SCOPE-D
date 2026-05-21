#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const BUNDLE_SCHEMA = 'config/schemas/k8s-manifest-bundle.schema.json';
const ASSESSMENT_SCHEMA = 'config/schemas/k8s-manifest-assessment.schema.json';

function usage() {
  console.log('Usage: node scripts/evaluate-k8s-manifests.js <k8s-manifest-bundle.json> [--out <assessment.json>]');
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
  if (!args.input) throw new Error('Missing Kubernetes manifest bundle path.');
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
  return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'k8s';
}

function objectRef(obj) {
  const ns = obj.metadata && obj.metadata.namespace ? `${obj.metadata.namespace}/` : '';
  return `${obj.kind}:${ns}${obj.metadata.name}`;
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

function finding(obj, category, severity, evidence, recommendation) {
  const ref = objectRef(obj);
  return {
    id: `finding:${slug(ref)}:${category}`,
    objectRef: ref,
    category,
    severity,
    evidence,
    recommendation,
  };
}

function containersFor(obj) {
  const podSpec = obj.kind === 'Pod'
    ? obj.spec
    : obj.spec && obj.spec.template && obj.spec.template.spec;
  return {
    podSpec: podSpec || {},
    containers: (podSpec && Array.isArray(podSpec.containers)) ? podSpec.containers : [],
    volumes: (podSpec && Array.isArray(podSpec.volumes)) ? podSpec.volumes : [],
  };
}

function evaluateWorkload(obj) {
  const findings = [];
  if (!['Pod', 'Deployment', 'DaemonSet', 'StatefulSet', 'Job', 'CronJob'].includes(obj.kind)) return findings;

  const { podSpec, containers, volumes } = containersFor(obj);
  if (podSpec.hostNetwork === true || podSpec.hostPID === true || podSpec.hostIPC === true) {
    findings.push(finding(obj, 'host_access', 'high', { hostNetwork: podSpec.hostNetwork, hostPID: podSpec.hostPID, hostIPC: podSpec.hostIPC }, 'Disable host namespace access unless separately approved.'));
  }

  for (const volume of volumes) {
    if (volume.hostPath) {
      findings.push(finding(obj, 'host_access', 'critical', { volumeName: volume.name, hostPath: volume.hostPath }, 'Remove hostPath volumes or constrain them to read-only approved paths.'));
    }
    if (volume.secret) {
      findings.push(finding(obj, 'secret_mount', 'medium', { volumeName: volume.name, secret: volume.secret }, 'Minimize mounted secrets and prefer scoped runtime identity.'));
    }
  }

  if (podSpec.serviceAccountName && podSpec.serviceAccountName !== 'default') {
    findings.push(finding(obj, 'service_account', 'low', { serviceAccountName: podSpec.serviceAccountName }, 'Verify service account permissions are least-privilege and namespace-scoped.'));
  }

  for (const container of containers) {
    const sc = container.securityContext || {};
    if (sc.privileged === true || sc.allowPrivilegeEscalation === true || sc.runAsUser === 0) {
      findings.push(finding(obj, 'pod_security', 'critical', { container: container.name, securityContext: sc }, 'Disable privileged mode, privilege escalation, and root user execution.'));
    }
    if (!container.resources || !container.resources.requests || !container.resources.limits) {
      findings.push(finding(obj, 'resource_controls', 'medium', { container: container.name, resources: container.resources || {} }, 'Set CPU/memory requests and limits.'));
    }
    for (const mount of container.volumeMounts || []) {
      if (String(mount.mountPath || '').includes('/var/run/docker.sock')) {
        findings.push(finding(obj, 'host_access', 'critical', { container: container.name, mountPath: mount.mountPath }, 'Do not mount container runtime sockets into workloads.'));
      }
    }
  }

  return findings;
}

function evaluateService(obj) {
  if (obj.kind !== 'Service') return [];
  const type = obj.spec && obj.spec.type;
  if (type === 'LoadBalancer' || type === 'NodePort') {
    return [finding(obj, 'service_exposure', type === 'LoadBalancer' ? 'high' : 'medium', { type, ports: obj.spec.ports || [] }, 'Avoid direct external service exposure unless explicitly approved and protected.')];
  }
  return [];
}

function evaluateRbac(obj) {
  if (obj.kind !== 'ClusterRoleBinding' && obj.kind !== 'RoleBinding') return [];
  const roleRef = obj.roleRef || {};
  if (roleRef.name === 'cluster-admin' || obj.kind === 'ClusterRoleBinding') {
    return [finding(obj, 'rbac_overgrant', roleRef.name === 'cluster-admin' ? 'critical' : 'high', { kind: obj.kind, roleRef, subjects: obj.subjects || [] }, 'Use least-privilege namespace-scoped roles instead of broad role bindings.')];
  }
  return [];
}

function evaluateServiceAccount(obj) {
  if (obj.kind !== 'ServiceAccount') return [];
  if (obj.automountServiceAccountToken !== false) {
    return [finding(obj, 'service_account', 'medium', { automountServiceAccountToken: obj.automountServiceAccountToken }, 'Set automountServiceAccountToken=false unless the workload requires API access.')];
  }
  return [];
}

function evaluateNetworkPolicies(bundle) {
  const hasNetworkPolicy = bundle.manifests.some((obj) => obj.kind === 'NetworkPolicy');
  if (hasNetworkPolicy) return [];
  return [{
    id: `finding:${slug(bundle.namespace)}:network-policy-missing`,
    objectRef: `Namespace:${bundle.namespace}`,
    category: 'network_policy',
    severity: 'medium',
    evidence: { namespace: bundle.namespace, networkPolicyPresent: false },
    recommendation: 'Add default-deny NetworkPolicy and explicit allow rules for required traffic.',
  }];
}

function assess(bundle, bundleRef) {
  const findings = [];
  for (const obj of bundle.manifests) {
    findings.push(...evaluateWorkload(obj));
    findings.push(...evaluateService(obj));
    findings.push(...evaluateRbac(obj));
    findings.push(...evaluateServiceAccount(obj));
  }
  findings.push(...evaluateNetworkPolicies(bundle));

  const riskScore = Math.min(100, findings.reduce((sum, item) => sum + score(item.severity), 0));
  return {
    schemaVersion: '0.1.0',
    assessmentId: `k8s-manifest-assessment:${slug(bundle.namespace)}`,
    bundleRef,
    environment: bundle.environment,
    namespace: bundle.namespace,
    riskScore,
    riskLevel: riskLevel(riskScore),
    objectCount: bundle.manifests.length,
    findings,
    recommendedControls: Array.from(new Set(findings.map((item) => item.recommendation))),
    redactionState: bundle.redactionState,
    liveClusterAccessUsed: false,
    kubectlExecuted: false,
  };
}

try {
  const args = parseArgs(process.argv);
  const bundle = readJson(args.input);
  validate(BUNDLE_SCHEMA, bundle, 'Kubernetes manifest bundle');
  if (bundle.liveClusterAccessUsed !== false) throw new Error('Evaluator refuses liveClusterAccessUsed=true.');
  if (bundle.kubectlExecuted !== false) throw new Error('Evaluator refuses kubectlExecuted=true.');
  const assessment = assess(bundle, args.input);
  validate(ASSESSMENT_SCHEMA, assessment, 'Kubernetes manifest assessment');
  if (args.out) writeJson(args.out, assessment);
  process.stdout.write(`${JSON.stringify(assessment, null, 2)}\n`);
} catch (err) {
  console.error(`evaluate-k8s-manifests failed: ${err.message}`);
  process.exit(1);
}
