#!/usr/bin/env node
'use strict';

/**
 * arsenal-owasp-asi.js
 * OWASP Top 10 for Agentic Applications (December 2025) constants and mappings.
 * Source: OWASP Agentic Security Summit / Black Hat Europe 2025.
 * See: https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications/
 *
 * ASI01-ASI10 titles ported from promptfoo/src/redteam/constants/frameworks.ts
 * (OWASP_AGENTIC_NAMES + OWASP_AGENTIC_TOP_10_MAPPING, December 2025 edition).
 * No external dependencies.
 */

/**
 * OWASP Agentic Security Initiative top-10 entries.
 * Severity ratings are SCOPE-D defensive assessments of each category's
 * typical blast radius; they are not part of the upstream OWASP specification.
 */
const OWASP_ASI = {
  ASI01: {
    id: 'ASI01',
    title: 'Agent Goal Hijack',
    description: 'Attacker alters an agent\'s objectives or decision path through malicious content (prompt injection, indirect injection).',
    severity: 'critical',
    mitigations: ['input_validation', 'output_filtering', 'context_isolation', 'intent_verification'],
  },
  ASI02: {
    id: 'ASI02',
    title: 'Tool Misuse and Exploitation',
    description: 'Agent uses legitimate tools in unsafe or unintended ways.',
    severity: 'high',
    mitigations: ['tool_sandboxing', 'capability_restriction', 'output_encoding', 'schema_validation'],
  },
  ASI03: {
    id: 'ASI03',
    title: 'Identity and Privilege Abuse',
    description: 'Agents inherit user/system identities with high-privilege credentials, enabling privilege escalation.',
    severity: 'high',
    mitigations: ['least_privilege', 'rbac_enforcement', 'identity_binding', 'credential_scoping'],
  },
  ASI04: {
    id: 'ASI04',
    title: 'Agentic Supply Chain Vulnerabilities',
    description: 'Compromised tools, plugins, prompt templates, and external servers injected into the agent supply chain.',
    severity: 'high',
    mitigations: ['artifact_signing', 'sbom_verification', 'data_provenance', 'supply_chain_attestation'],
  },
  ASI05: {
    id: 'ASI05',
    title: 'Unexpected Code Execution',
    description: 'Agents generate or run code/commands unsafely, enabling shell injection, SQL injection, or SSRF.',
    severity: 'critical',
    mitigations: ['code_sandboxing', 'output_redaction', 'command_allowlisting', 'network_egress_control'],
  },
  ASI06: {
    id: 'ASI06',
    title: 'Memory and Context Poisoning',
    description: 'Attackers poison agent memory systems, embeddings, and RAG databases to bias future behavior.',
    severity: 'high',
    mitigations: ['memory_integrity_check', 'context_scrubbing', 'rag_source_validation', 'embedding_provenance'],
  },
  ASI07: {
    id: 'ASI07',
    title: 'Insecure Inter-Agent Communication',
    description: 'Multi-agent systems face spoofed identities, replayed messages, and tampered payloads.',
    severity: 'high',
    mitigations: ['message_signing', 'agent_identity_attestation', 'replay_protection', 'plugin_sandboxing'],
  },
  ASI08: {
    id: 'ASI08',
    title: 'Cascading Failures',
    description: 'Small errors in one agent propagate across planning, execution, and memory in multi-agent pipelines.',
    severity: 'medium',
    mitigations: ['circuit_breaker', 'human_approval_gate', 'action_receipt', 'confidence_floor'],
  },
  ASI09: {
    id: 'ASI09',
    title: 'Human Agent Trust Exploitation',
    description: 'Users over-trust agent recommendations, enabling social engineering and misinformation attacks.',
    severity: 'medium',
    mitigations: ['confidence_floor', 'verifier_economy', 'source_attribution', 'uncertainty_disclosure'],
  },
  ASI10: {
    id: 'ASI10',
    title: 'Rogue Agents',
    description: 'Compromised or misaligned agents act harmfully while appearing legitimate.',
    severity: 'high',
    mitigations: ['least_privilege', 'human_approval_gate', 'action_receipt', 'agent_attestation', 'access_control'],
  },
};

/**
 * Map a SCOPE-D observation category to relevant OWASP ASI IDs.
 * Based on the OWASP_AGENTIC_TOP_10_MAPPING plugin-to-category logic
 * from promptfoo/src/redteam/constants/frameworks.ts.
 *
 * @param {string} observationCategory
 * @returns {string[]} array of ASI IDs (e.g. ['ASI04', 'ASI05'])
 */
function mapCategoryToASI(observationCategory) {
  const cat = String(observationCategory).toLowerCase();

  switch (cat) {
    case 'package_vulnerability':
      // Supply chain compromise of a dependency → ASI04 (supply chain)
      // May enable unexpected code execution → ASI05
      return ['ASI04', 'ASI05'];

    case 'known_exploited_vulnerability':
    case 'exploit_probability':
      // Exploitable vuln in infrastructure → ASI05 (unexpected code execution)
      // Can enable privilege abuse → ASI03
      return ['ASI05', 'ASI03'];

    case 'malware_reputation':
      // Malware delivery = agent goal hijack vector → ASI01
      // May exploit excessive agency → (maps to ASI10 rogue agent scenario)
      return ['ASI01', 'ASI10'];

    case 'phishing':
      // Phishing = human trust exploitation → ASI09
      // Can also hijack agent goals via injected content → ASI01
      return ['ASI09', 'ASI01'];

    case 'campaign_context':
      // Attributed campaign = coordinated threat including rogue-agent/multi-agent abuse
      // Maps to ASI10 (rogue agents), ASI07 (inter-agent comms)
      return ['ASI10', 'ASI07'];

    case 'exposure_context':
      // Exposed surface = initial access for privilege abuse → ASI03
      // Also enables unexpected code execution → ASI05
      return ['ASI03', 'ASI05'];

    case 'internet_noise':
      // Opportunistic scanning is a low-signal precursor; loosely maps to
      // cascading failures from uncontrolled external input → ASI08
      return ['ASI08'];

    case 'prompt_injection':
    case 'indirect_prompt_injection':
      return ['ASI01', 'ASI06'];

    case 'tool_misuse':
    case 'excessive_agency':
      return ['ASI02', 'ASI10'];

    case 'memory_poisoning':
    case 'rag_poisoning':
      return ['ASI06'];

    case 'inter_agent':
    case 'multi_agent':
      return ['ASI07', 'ASI08'];

    case 'trust_exploitation':
    case 'overreliance':
      return ['ASI09'];

    default:
      // Unknown category — return empty array; callers should handle gracefully
      return [];
  }
}

/**
 * Map an OWASP ASI ID to the most representative ATT&CK technique.
 * Derived from the MITRE ATLAS and OWASP agentic plugin mappings in frameworks.ts.
 *
 * @param {string} asiId  e.g. 'ASI01'
 * @returns {string|null} ATT&CK technique ID or null if unknown
 */
function mapASIToAttackTechnique(asiId) {
  const mapping = {
    ASI01: 'T1059.004', // Command and Scripting Interpreter: Unix Shell (prompt injection → exec)
    ASI02: 'T1203',     // Exploitation for Client Execution (tool misuse)
    ASI03: 'T1078',     // Valid Accounts (privilege abuse via inherited credentials)
    ASI04: 'T1195',     // Supply Chain Compromise
    ASI05: 'T1059',     // Command and Scripting Interpreter (code execution)
    ASI06: 'T1565',     // Data Manipulation (memory/context poisoning)
    ASI07: 'T1557',     // Adversary-in-the-Middle (inter-agent comms spoofing)
    ASI08: 'T1499',     // Endpoint Denial of Service (cascading failures → DoS)
    ASI09: 'T1204',     // User Execution (human trust exploitation)
    ASI10: 'T1036',     // Masquerading (rogue agent pretending to be legitimate)
  };
  return mapping[String(asiId).toUpperCase()] || null;
}

module.exports = { OWASP_ASI, mapCategoryToASI, mapASIToAttackTechnique };
