# Agent Harness Risk Controls

Status: v0.1 planning baseline  
Owner plane: SCOPE-D defensive validation  
Consumers: Delivery Excellence, Policy Fabric, AgentPlane, Memory Mesh, SourceOS, BearBrowser, TurtleTerm, SocioSphere

## Purpose

The Aden/Hive production-agent pattern introduces reusable skills, MCP servers, browser automation, terminal actions, memory writeback, generated graphs, judge loops, and evolution patches. SCOPE-D owns the defensive validation lane for those capability surfaces.

This document defines the risk-control surface that turns agent harness risk into measurable delivery/security evidence.

## Boundary

SCOPE-D owns:

- safe synthetic validation exercises
- AI infrastructure risk assessment
- MCP/tool server risk assessment
- agent skill risk assessment
- memory poisoning and recall/writeback abuse checks
- browser automation abuse checks
- terminal command risk checks
- graph robustness checks
- detection/control packaging
- verified run summaries for handoff

SCOPE-D does not own:

- runtime execution authority; AgentPlane owns it
- policy admission authority; Policy Fabric owns it
- Delivery Excellence scoreboards and KPI definitions
- Memory Mesh runtime implementation
- BearBrowser or TurtleTerm product behavior
- SocioSphere topology authority

## Risk-control lanes

### SkillRiskAssessment

Targets portable `SKILL.md` and governed SourceOS skill envelopes.

Checks:

- prompt-injection content
- hidden tool instructions
- unsafe script execution
- filesystem overreach
- network overreach
- credential access requests
- missing evals
- missing threat model
- missing license/provenance
- unpinned dependencies
- trust-tier mismatch

### MCPServerRiskAssessment

Targets MCP servers and tool namespaces.

Checks:

- tool schema drift
- namespace collision
- unpinned server version
- unsafe transport
- unauthenticated local endpoint
- credential scope overreach
- filesystem/network overreach
- missing health check
- prompt/tool poisoning surface
- revocation behavior

### BrowserAutomationRiskAssessment

Targets BearBrowser/browser-use workflows.

Checks:

- credential exfiltration
- CSRF/local-origin abuse
- unauthorized form submit
- stealth/evasion misuse
- malicious download bypass
- upload leakage
- external message-send risk
- account-setting mutation
- page-content prompt injection
- domain allowlist bypass

### TerminalActionRiskAssessment

Targets TurtleTerm, agent-term, shell receipts, and workstation contracts.

Checks:

- command injection
- shell escape
- destructive command bypass
- privilege escalation
- unauthorized filesystem mutation
- secret exfiltration
- package install risk
- unauthorized service exposure
- host/cluster mutation bypass
- generated script risk

### MemoryRiskAssessment

Targets Memory Mesh and context-pack flows.

Checks:

- memory poisoning
- cross-tenant recall bleed
- sensitive-payload storage bypass
- retrieval prompt injection
- writeback abuse
- redaction bypass
- artifact pointer spoofing
- vector-store drift
- contradiction/drift propagation

### GraphRobustnessAssessment

Targets AgentPlane graphs, policy graphs, memory graphs, trust graphs, and evidence graphs.

Checks:

- unbounded loops
- missing failure edges
- unsafe retry paths
- hidden side-effect nodes
- judge confidence bypass
- promotion gate bypass
- graph injection
- policy-edge inconsistency
- dependency-cycle risk
- missing rollback path

### EvolutionPatchRiskAssessment

Targets proposed graph/prompt/tool/skill/policy/code changes.

Checks:

- self-promotion attempt
- hidden authority expansion
- policy weakening
- test removal
- evidence removal
- rollback removal
- prompt injection in patch text
- risky dependency introduction
- supply-chain degradation

## Evidence outputs

Every SCOPE-D agent-harness risk run should emit:

- risk assessment manifest
- safe synthetic event stream
- finding records
- recommended controls
- policy gate refs
- affected asset refs
- run receipt
- verified run summary
- Delivery Excellence projection fields

## Delivery Excellence projection

SCOPE-D should export or support projection into these Delivery Excellence metrics:

- skill risk score
- MCP server risk score
- browser automation risk score
- terminal action risk score
- memory risk score
- graph robustness score
- open high-risk findings
- blocked promotion count
- verified-run count
- control coverage count
- defect/regression count

Delivery Excellence consumes risk scores and verified summaries, not unsafe exploit payloads.

## Policy Fabric integration

Policy Fabric should consume SCOPE-D findings as inputs to:

- SkillGrantGate
- MCPGrantGate
- BrowserActionGate
- TerminalActionGate
- MemoryGate
- GraphAdmissionGate
- PromotionGate

High-risk or unverified assets should default to blocked, quarantined, or human-review-required posture.

## AgentPlane integration

AgentPlane should cite SCOPE-D risk results in:

- EvidencePack
- PromotionGate
- FailureDiagnosis
- EvolutionPatch review
- graph/template/skill promotion records

## Memory Mesh integration

Memory-related findings should reference Memory Mesh artifact pointers and context-pack refs instead of raw sensitive payloads.

## SourceOS integration

SourceOS execution receipt classes should be SCOPE-D assessment targets:

- LocalAgentRuntimeReceipt
- ShellReceiptEvent
- BrowserActionReceipt
- ModelCarryRouteReceipt
- HostMutationBoundaryReceipt
- DownloadArtifactReceipt

## Non-negotiables

- SCOPE-D defaults to read-only, synthetic, and dry-run validation.
- No deployable malware, C2 payloads, credential theft workflows, destructive automation, or unauthorized execution logic belongs in this repo.
- Risk findings must preserve provenance and safe evidence.
- Risk scores must be traceable to verified run summaries.
- Delivery Excellence receives risk metrics and customer-safe summaries, not unsafe payloads.

## Near-term implementation path

1. Add schemas/examples for the assessment lanes above.
2. Add safe synthetic fixtures for skill, MCP, browser, terminal, memory, graph, and evolution-patch risk.
3. Extend verified run reporting with agent-harness risk fields.
4. Add Delivery Excellence metric projection examples.
5. Wire Policy Fabric gate docs to consume SCOPE-D risk results.
