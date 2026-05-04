# SCOPE-D AI Infrastructure Assessment

This directory is for AI-native attack-surface assessment modules. The goal is to bring AI-Infra-Guard-style coverage into SCOPE-D while preserving SCOPE-D's read-only, policy-gated, evidence-first execution doctrine.

## Target surfaces

SCOPE-D should assess:

- local and remote model servers;
- MCP servers;
- MCP tools;
- agent skills;
- vector stores;
- memory stores;
- workflow agents;
- browser or desktop automation surfaces;
- local unauthenticated service endpoints;
- public network exposure;
- jailbreak and prompt-injection exposure;
- tool poisoning and skill poisoning exposure.

## Initial assessment categories

| Category | Purpose | Default mode |
|---|---|---|
| Fingerprint | Identify AI infra components and versions | read_only |
| Exposure | Detect unauthenticated listeners, unsafe origins, public bind addresses | read_only |
| MCP Risk | Inspect MCP server/tool manifests for excessive permission and unsafe tool boundaries | read_only |
| Skill Risk | Inspect agent skill manifests, allowed tools, memory access, and command surfaces | read_only |
| Prompt/Jailbreak | Evaluate model or agent prompts against curated synthetic test cases | synthetic_only |
| Tool Poisoning | Detect tool-description ambiguity, hidden instruction channels, and unsafe argument schemas | read_only |
| Memory Boundary | Verify scoped memory isolation and tenant/resource redaction | read_only |
| Capability Boundary | Verify least-privilege capability tokens and blocked destructive operations | read_only |

## Output contract

Every module should emit `AIInfraAssessment` evidence as SCOPE-D control-loop evidence envelopes. Minimum fields:

- target surface;
- component type;
- component version when available;
- finding category;
- severity;
- confidence;
- evidence;
- recommended countermeasure;
- policy gate required before any mutation.

## Safety constraints

Do not run exploit payloads. Do not jailbreak a third-party service. Do not scan public infrastructure without explicit authorization. Do not exfiltrate secrets. Do not persist prompts, tokens, customer identifiers, or resource IDs into global memory.

High-risk evaluations must run in synthetic mode until a human gate and policy decision approve a bounded live test.
