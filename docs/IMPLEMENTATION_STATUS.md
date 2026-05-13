# SCOPE-D Implementation Status

**Status date:** 2026-05-13
**Scope:** This ledger separates implemented repository artifacts from roadmap, design doctrine, and unimplemented runtime claims.

## Current implemented layer

SCOPE-D currently has a real contract-first substrate. The following pieces are implemented in-repo:

- package scripts for contract validation, synthetic event generation, run initialization, run verification, run reporting, Ontogenesis export, and tamper smoke testing;
- JSON Schema contracts and conforming examples for the core SCOPE-D control loop and multiple supporting objects;
- synthetic-only atomic validation template and synthetic event generation;
- synthetic run initialization under `runs/<run-id>/`;
- run verification with required artifact checks, AJV validation, JSONL validation, receipt hash verification, and cross-artifact consistency checks;
- deterministic run reporting through `run-summary.json` and `run-summary.md`;
- Ontogenesis-compatible RDF/Turtle export from verified run summaries;
- contract validation safety invariants that reject live execution in examples and require synthetic/read-only/dry-run posture for example artifacts;
- first SCOPE-D hardening contracts for Event-IR, Identity-IR, ProofArtifact, and EngagementPolicy.

## Implemented but still prototype-grade

These pieces exist but should be treated as early v0.1 scaffolding:

- Ontogenesis export currently emits a compact graph with placeholder countermeasure mapping;
- SocioSphere and PolicyFabric handoff fields in run summaries are static readiness flags, not a live integration;
- ProofArtifact dynamic metrics, configuration volume, and archetype fields are schema-level fields only until analyzers populate them;
- EngagementPolicy expresses authority and boundaries, but no runtime admission controller currently enforces it.

## Captured design lanes

The following lanes are captured as doctrine or README-level design and require implementation before they can be treated as working system capabilities:

- AI infrastructure and MCP assessment modules;
- graph robustness fixtures, perturbation tests, and scoring;
- detection-as-code rule catalog and deployment gates;
- threat-intel feed ingestion and indicator lifecycle;
- purple-team exercise orchestration beyond examples;
- SourceOS / SocioSphere / PolicyFabric / AgentPlane runtime integration;
- live dashboards for exercise maturity, detection coverage, AI infra risk, graph robustness, and run receipts.

## Not yet implemented

The following are not currently implemented as runtime control fabric in this repository:

- live collectors for AWS, GitHub, Kubernetes, local hosts, AI runtimes, MCP servers, or agent skills;
- PolicyFabric admission control enforcing `EngagementPolicy` decisions;
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

1. Keep contract validation green after every new schema/example pair.
2. Add CI to run `npm test` on pull requests.
3. Add `EngagementPolicy` checking to run initialization and any future collector entrypoint.
4. Add `Event-IR` emission to synthetic run initialization.
5. Add `ProofArtifact` emission to synthetic run initialization.
6. Add one AI-infra synthetic scenario as the first vertical slice.
7. Add graph robustness synthetic fixture and first edge-injection scoring proof.
8. Add SocioSphere-ready dashboard JSON summary export.
9. Add 23-topic `lsa-map.json` as configuration, not runtime magic.
10. Create issues for each runtime lane before adding more prose.
