# SCOPE-D Implementation Status

**Status date:** 2026-05-13
**Scope:** This ledger separates implemented repository artifacts from roadmap, design doctrine, and unimplemented runtime claims.

## Current implemented layer

SCOPE-D currently has a real contract-first substrate. The following pieces are implemented in-repo:

- package scripts for contract validation, synthetic event generation, engagement-policy-gated run initialization, AI-infra synthetic run initialization, run verification, run reporting, Ontogenesis export, engagement-policy fail-closed tests, AI-infra slice smoke tests, and tamper smoke testing;
- JSON Schema contracts and conforming examples for the core SCOPE-D control loop and multiple supporting objects;
- synthetic-only atomic validation template and synthetic event generation;
- generated synthetic runs under `runs/<run-id>/`;
- fail-closed `EngagementPolicy` enforcement for `scope-d:init` and `scope-d:init-ai-infra`:
  - no policy file means hard failure,
  - unreadable policy path means hard failure,
  - schema-invalid policy means hard failure,
  - unauthorized target/surface/mode means hard failure,
  - `live_engage` cannot be authorized unless Michael approval is explicitly required;
- generated generic synthetic runs that emit the first complete contract vertical slice:
  - EngagementPolicy (`engagement-policy.json`),
  - SyntheticEvent (`events.jsonl`),
  - Event-IR (`event-ir.jsonl`),
  - Identity-IR (`identity-ir.json`),
  - ProofArtifact (`proof-artifact.json`),
  - ControlLoopRun (`control-loop.json`),
  - RunReceipt (`receipt.json`),
  - RunSummary (`run-summary.json` / `run-summary.md`),
  - Ontogenesis RDF export (`ontogenesis.ttl`);
- generated AI-infra synthetic runs that add:
  - synthetic MCP tool manifest (`mcp-tool-manifest.synthetic.json`),
  - AIInfraAssessment (`ai-infra-assessment.json`),
  - MCPToolRisk (`mcp-tool-risk.json`),
  - CountermeasureRule (`countermeasure-rule.json`);
- run verification with required artifact checks, AJV validation, engagement-policy authorization checks, JSONL validation, Event-IR validation, Identity-IR validation, ProofArtifact validation, optional AI-infra domain artifact validation, receipt hash verification, and cross-artifact consistency checks;
- deterministic run reporting through `run-summary.json` and `run-summary.md`, including Event-IR, Identity-IR, ProofArtifact, AIInfraAssessment, MCPToolRisk, and CountermeasureRule counts;
- Ontogenesis-compatible RDF/Turtle export from verified run summaries, including vertical-slice and AI-infra triples when present;
- contract validation safety invariants that reject live execution in examples and require synthetic/read-only/dry-run posture for example artifacts;
- SCOPE-D hardening contracts for Event-IR, Identity-IR, ProofArtifact, EngagementPolicy, AIInfraAssessment, MCPToolRisk, CountermeasureRule, and the 23-topic LSA operating map;
- GitHub Actions workflow for contract validation, synthetic event generation, engagement-policy-gated safe run initialization, AI-infra vertical-slice initialization, run verification, reporting, Ontogenesis export, engagement-policy fail-closed tests, AI-infra smoke tests, and tamper detection.

## Implemented but still prototype-grade

These pieces exist but should be treated as early v0.1 scaffolding:

- Ontogenesis export emits compact graph terms and first AI-infra triples, but ontology terms are still lightweight and may need alignment with the full Ontogenesis domain model;
- SocioSphere and PolicyFabric handoff fields in run summaries are static readiness flags, not a live integration;
- ProofArtifact dynamic metrics, configuration volume, and archetype fields are populated for synthetic runs, but no real analyzer computes them yet;
- EngagementPolicy is now enforced for repo-local synthetic runners, but no runtime admission controller currently enforces it for future live collectors beyond existing scripts;
- the AI-infra slice is synthetic fixture-based and recommendation-only; no live MCP server, tool execution, network call, credential access, or deployment occurs;
- the 23-topic LSA map is validated configuration, not a learned model or orchestration runner.

## Captured design lanes

The following lanes are captured as doctrine or README-level design and require implementation before they can be treated as working system capabilities:

- live AI infrastructure and MCP assessment modules;
- graph robustness fixtures, perturbation tests, and scoring;
- detection-as-code rule catalog and deployment gates;
- threat-intel feed ingestion and indicator lifecycle;
- purple-team exercise orchestration beyond examples;
- SourceOS / SocioSphere / PolicyFabric / AgentPlane runtime integration;
- live dashboards for exercise maturity, detection coverage, AI infra risk, graph robustness, and run receipts.

## Not yet implemented

The following are not currently implemented as runtime control fabric in this repository:

- live collectors for AWS, GitHub, Kubernetes, local hosts, AI runtimes, MCP servers, or agent skills;
- live MCP server fingerprinting or tool execution;
- PolicyFabric admission control enforcing `EngagementPolicy` decisions beyond repo-local scripts;
- FROST quorum signing or commission/promotion governance;
- Triune / FPGL / Memphis / BridgeMode operational CRDs;
- abstract-interpretation analyzers for interval, congruence, grid, sharing, or NNC-polyhedra domains;
- HSM congruence non-escape analyzer;
- DP budget and raw-identity non-escape analyzer;
- browser adversarial lab bundle;
- ABIS / implant-shape profile runner;
- media/channel profile catalog as executable profiles;
- 23-topic LSA/LSI training orchestration.

## Development rule

A feature is considered **implemented** only when it has at least one of the following:

1. executable code path;
2. schema and conforming example validated by `npm test`;
3. documented CLI command that writes verified artifacts;
4. CI-enforced validation;
5. runtime policy enforcement artifact.

Architecture prose alone is **captured design**, not implementation.

## Immediate next implementation targets

1. Confirm the contract-validation workflow is enabled and green on the latest main commit; then require it in branch protection.
2. Add graph robustness synthetic fixture and first edge-injection scoring proof.
3. Add SocioSphere-ready dashboard JSON summary export.
4. Add a 23-topic map report command that distinguishes captured-design lanes from proof-producing lanes.
5. Extend EngagementPolicy enforcement to every future collector and runner entrypoint.
6. Enable GitHub Issues or replace this file-based backlog with a proper project board.
