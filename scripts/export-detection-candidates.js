#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA = 'config/schemas/detection-candidate-export.schema.json';

function usage() {
  console.log('Usage: node scripts/export-detection-candidates.js <intelligence-enrichment.json> [--out <detection-candidates.json>]');
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
  if (!args.input) throw new Error('Missing intelligence enrichment path.');
  return args;
}
function abs(file) { return path.isAbsolute(file) ? file : path.join(ROOT, file); }
function rel(file) { return path.relative(ROOT, abs(file)).replace(/\\/g, '/'); }
function readJson(file) { return JSON.parse(fs.readFileSync(abs(file), 'utf8')); }
function writeJson(file, value) {
  const out = abs(file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function slug(value) { return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'candidate'; }
function validate(value) {
  const schema = readJson(SCHEMA);
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validator = ajv.compile(schema);
  if (!validator(value)) {
    const details = (validator.errors || []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
    throw new Error(`detection candidate export failed schema validation: ${details}`);
  }
}

const CONFIDENCE_FLOOR = 0.7;

function exploitScenario(category, provider) {
  if (category === 'malware_reputation') return `An adversary could deliver a malicious artifact via ${provider}-tracked hash; a host executing this artifact would not be detected without hash-based or behavioral coverage.`;
  if (category === 'internet_noise') return `An opportunistic scanner or botnet node tracked by ${provider} could probe exposed services; without ingress detection the activity blends into background noise.`;
  if (category === 'phishing') return `An adversary could send a ${provider}-flagged phishing URL to users; without link-reputation or redirect-chain inspection the initial access attempt goes undetected.`;
  if (category === 'known_exploited_vulnerability') return `An adversary aware of this ${provider}-catalogued KEV could exploit the vulnerable component before patching; exploitation leaves observable indicators in process and network telemetry.`;
  if (category === 'exploit_probability') return `This vulnerability has a ${provider}-scored high exploit probability; an adversary could weaponize it against unpatched hosts and evade detection absent targeted coverage.`;
  if (category === 'package_vulnerability') return `A ${provider}-flagged package vulnerability could be triggered by supply-chain compromise or direct dependency exploitation; the attack surface is widest in CI/CD and build environments.`;
  if (category === 'campaign_context') return `An actor associated with this ${provider}-attributed campaign could reuse known infrastructure or TTPs; without campaign-aware detections the activity appears isolated.`;
  if (category === 'exposure_context') return `An externally-exposed surface surfaced by ${provider} gives an adversary a validated foothold target; exploitation would not be detected without appropriate perimeter and host telemetry.`;
  return `A threat actor could leverage this ${provider}-observed indicator to conduct adversarial operations that would not be detected without the proposed coverage.`;
}

function attackMappings(category) {
  if (category === 'malware_reputation') return ['ATT&CK:T1204'];
  if (category === 'internet_noise') return ['ATT&CK:T1595'];
  if (category === 'phishing') return ['ATT&CK:T1566'];
  if (category === 'known_exploited_vulnerability' || category === 'exploit_probability') return ['ATT&CK:T1190'];
  if (category === 'package_vulnerability') return ['ATT&CK:T1195'];
  if (category === 'campaign_context') return ['ATT&CK:T1589'];
  if (category === 'exposure_context') return ['ATT&CK:T1595'];
  return ['ATT&CK:T1595'];
}
function familyFor(category) {
  if (category === 'malware_reputation') return ['sigma', 'yara', 'osquery'];
  if (category === 'internet_noise' || category === 'exposure_context') return ['sigma', 'suricata'];
  if (category === 'phishing') return ['sigma', 'suricata'];
  if (category === 'known_exploited_vulnerability' || category === 'exploit_probability') return ['sigma', 'opa_rego', 'sourceos_policy'];
  if (category === 'package_vulnerability') return ['osquery', 'opa_rego', 'github_policy'];
  if (category === 'campaign_context') return ['sigma'];
  return ['sigma'];
}
function ruleBody(family, observation) {
  const safeTitle = observation.category.replace(/_/g, ' ');
  if (family === 'sigma') return `title: SCOPE-D ${safeTitle}\nstatus: experimental\nlogsource:\n  product: scope-d\ndetection:\n  selection:\n    scope_d_category: ${observation.category}\n    provider: ${observation.provider}\n  condition: selection\nlevel: ${observation.severity}`;
  if (family === 'yara') return `rule SCOPE_D_${observation.category.toUpperCase()} {\n  meta:\n    source = "${observation.observationId}"\n    scope = "defensive_detection_candidate"\n  condition:\n    false\n}`;
  if (family === 'osquery') return `SELECT '${observation.category}' AS scope_d_category, '${observation.provider}' AS provider WHERE 1 = 1;`;
  if (family === 'opa_rego') return `package scope_d.detection\n\ndefault allow = false\n\nfinding if {\n  input.scope_d_category == "${observation.category}"\n}`;
  if (family === 'suricata') return `# SCOPE-D candidate only: ${observation.category} from ${observation.provider}`;
  if (family === 'github_policy') return `github_policy:\n  category: ${observation.category}\n  source: ${observation.provider}\n  action: require_review`;
  if (family === 'sourceos_policy') return `sourceos_policy:\n  category: ${observation.category}\n  decision: review_required`;
  return `candidate: ${observation.category}`;
}
function targetFor(family) {
  if (family === 'suricata' || family === 'sourceos_policy') return 'cloudshell_fog';
  if (family === 'github_policy') return 'sourceos_policyfabric';
  if (family === 'opa_rego') return 'sourceos_policyfabric';
  return 'soc_pipeline';
}

function main() {
  const args = parseArgs(process.argv);
  const enrichment = readJson(args.input);
  if (enrichment.executionPerformed !== false) throw new Error('Refusing detection export from enrichment that performed execution.');
  const candidates = [];
  for (const observation of enrichment.observations || []) {
    for (const family of familyFor(observation.category)) {
      const candidateConfidence = Math.min(1, Math.round((observation.confidence - 0.05) * 100) / 100);
      if (candidateConfidence < CONFIDENCE_FLOOR) continue;
      const base = `${slug(observation.observationId.replace(/^intelligence-observation:/, ''))}-${family}`;
      const deploymentTarget = targetFor(family);
      candidates.push({
        candidateId: `detection-candidate:${base}`,
        family,
        title: `Arsenal: ${observation.category} via ${observation.provider}`,
        description: `Candidate ${family} detection derived from receipt-backed intelligence observation ${observation.observationId}.`,
        exploitScenario: exploitScenario(observation.category, observation.provider),
        severity: observation.severity,
        status: 'candidate',
        sourceObservationRef: observation.observationId,
        sourceEvidenceRefs: observation.evidenceRefs,
        attackMappings: attackMappings(observation.category),
        ruleBody: ruleBody(family, observation),
        deployment: {
          target: deploymentTarget,
          cloudshellFogEligible: deploymentTarget === 'cloudshell_fog',
          requiresOperatorApproval: true,
          executionAllowed: false,
          executionPerformed: false,
        },
        provenance: {
          generatedBy: 'scope-d-arsenal-v0.1',
          modelAssistance: 'whiterabbitneo_defensive_review',
          grounding: [observation.observationId, ...observation.evidenceRefs],
          confidence: candidateConfidence,
        },
      });
    }
  }
  if (candidates.length === 0) throw new Error('No detection candidates generated.');
  const output = {
    schemaVersion: '0.1.0',
    exportId: `detection-candidate-export:${slug(enrichment.enrichmentId.replace(/^intelligence-enrichment:/, ''))}`,
    generatedAt: new Date().toISOString(),
    sourceEnrichmentRef: rel(args.input),
    ruleFamilies: Array.from(new Set(candidates.map((candidate) => candidate.family))).sort(),
    candidates,
    cloudshellFog: {
      role: 'authorized_edge_operator_bastion',
      allowedModes: ['lab_review', 'read_only_observation', 'policy_gated_delivery', 'mesh_edge_assurance'],
      prohibitedModes: ['unauthorized_access', 'stealth_persistence', 'payload_execution', 'credential_collection', 'log_mutation', 'public_scanning'],
      deliveryState: 'candidate_only_requires_operator_approval',
    },
    whiteRabbitNeoWorkflow: {
      role: 'defensive_detection_review_assistant',
      allowedUse: ['rule_explanation', 'false_positive_review', 'coverage_gap_review', 'safe_lab_detection_triage'],
      blockedUse: ['payload_creation', 'evasion_guidance', 'credential_theft', 'unauthorized_exploitation', 'destructive_action'],
      requiresGrounding: true,
    },
    executionPerformed: false,
  };
  validate(output);
  if (args.out) writeJson(args.out, output);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

try { main(); } catch (err) { console.error(`export-detection-candidates failed: ${err.message}`); process.exit(1); }
