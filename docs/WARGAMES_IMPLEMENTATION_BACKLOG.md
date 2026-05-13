# Devine Intelligence Wargames — Implementation Backlog

Status: v0.1 implementation backlog  
Canonical program: Devine Intelligence Wargames  
Owner plane: SCOPE-D implementation planning, schemas, examples, CI, adapters, dashboards  
Implementation state: backlog only; no runtime implementation implied

## Purpose

This document converts the Wargames capture corpus into an implementation plan with teeth.

The current Wargames PR is a capture and reconciliation PR. It defines the architecture, governance, topic spine, evidence model, agent roles, OFIF surface, Ontogenesis relation, MeshRush relation, HellGraph relation, and dynamic engagement policy. It does not yet implement those capabilities.

A Wargames capability is not implemented until it has:

1. schema;
2. example;
3. CI validation;
4. proof or receipt shape;
5. explicit safety invariants;
6. owning repo or runtime boundary.

## Existing SCOPE-D implementation foundation

SCOPE-D already has a contract-validation foundation. The current validator pattern validates JSON schemas, example documents, and safety invariants for existing SCOPE-D objects.

Wargames should extend that foundation rather than create a parallel validation path.

## Implementation principles

1. **Contracts before runtime.** Every Wargames capability starts as a schema and example before code.
2. **CI before claims.** No capability is called implemented until CI validates it.
3. **Proof before promotion.** Every promoted action has proof refs, receipt refs, and rollback posture where applicable.
4. **Mode-aware.** DEFENSE and LEARNING have different required fields.
5. **Boundary-first.** BoundaryEvent is the canonical evidence unit.
6. **Approval-bound.** E4/E5/E6, BridgeMode, sensitive release, policy exceptions, and scope expansion require Michael Heller signoff until delegated policy exists.
7. **Client-safe.** OFIF exposes governed intelligence products, not raw internals.
8. **Ontology-backed.** Ontogenesis supplies semantic validation and ATT&CK coverage meaning.
9. **Graph-ready.** MeshRush consumes validated graph views; HellGraph preserves replayable proof/event streams.
10. **Disclosure-aware.** Regis / Identity Is Prime governs disclosure and learning reuse, not authorized defensive correlation.

## Phase 0 — Capture closeout

Goal: finish prose capture so nothing remains only in chat.

Status: mostly complete.

Completed capture files:

- `docs/DIVINE_INTELLIGENCE_WAR_GAMES_ALIGNMENT.md`
- `docs/GHOSTSPACE_GASC_ALIGNMENT.md`
- `docs/BOUNDARY_CYBER_HYPERGRAPH_ALIGNMENT.md`
- `docs/WARGAMES_AGENT_ROSTERS.md`
- `docs/WARGAMES_MODE_SWITCH.md`
- `docs/WARGAMES_MESHRUSH_REGIS_HELLER_ER_INTEGRATION.md`
- `docs/WARGAMES_ONTOGENESIS_ATTACK_INTEGRATION.md`
- `docs/WARGAMES_OFIF_ORION_INTEGRATION.md`
- `docs/WARGAMES_DYNAMIC_ENGAGEMENT_POLICY.md`
- `docs/WARGAMES_TOPICS_12_23_OPS.md`
- `docs/agents/WHISPER_AGENT_SPEC.md`
- `docs/agents/SCOUT_AGENT_SPEC.md`
- `docs/surfaces/FONT_RENDERING_SURFACE_DRILL.md`
- `docs/MEMPHIS_RITE_GOVERNANCE.md`
- `docs/WARGAMES_LSA_LSI_MAP.md`

Remaining capture files:

- `docs/WARGAMES_TREE_SITTER_LSA_BRIDGE.md`
- `docs/WARGAMES_HPST_VERIFIER_ECONOMY.md`
- `docs/IDENTITY_GEOMETRY_ER_PLUS_ALIGNMENT.md`
- `docs/surfaces/PUBLIC_INDEX_EXPOSURE_AUDIT.md`

Exit criteria:

- capture ledger has no untracked source family;
- every source family has a dedicated doc, section, backlog item, or conscious deferral;
- no prose doc claims runtime implementation.

## Phase 1 — Core schema slice

Goal: implement the smallest schema-backed slice that proves the architecture.

Recommended first slice:

1. Wargames mode;
2. Boundary event;
3. Evidence and negative evidence;
4. Scout profile proof;
5. Engagement trigger and authorization;
6. OFIF field observation.

### Schemas

Add:

- `config/schemas/wargames-mode.schema.json`
- `config/schemas/boundary-event.schema.json`
- `config/schemas/evidence.schema.json`
- `config/schemas/negative-evidence.schema.json`
- `config/schemas/scout-profile-proof.schema.json`
- `config/schemas/engagement-trigger.schema.json`
- `config/schemas/engagement-authorization.schema.json`
- `config/schemas/ofif-field-observation.schema.json`

### Examples

Add:

- `examples/scope-d/wargames/defense-run.example.json`
- `examples/scope-d/wargames/learning-run.example.json`
- `examples/scope-d/wargames/boundary-event-net-header.example.json`
- `examples/scope-d/wargames/evidence-negative-missing-record.example.json`
- `examples/scope-d/wargames/scout-profile-proof.example.json`
- `examples/scope-d/wargames/engagement-trigger-contained.example.json`
- `examples/scope-d/wargames/engagement-authorization-approved.example.json`
- `examples/scope-d/wargames/ofif-field-observation.example.json`

### CI checks

Update `scripts/validate-contracts.js` to enforce:

- Wargames run must declare mode.
- DEFENSE mode must declare scope, safety boundary, evidence refs, and proof refs.
- LEARNING mode must declare corpus refs, redaction state, reproducibility refs, and source run refs.
- BoundaryEvent must link Component/Port/Contract or their refs.
- NegativeEvidence must include expected source and time window.
- ScoutProfileProof must include Omega counts, LSA dims, LSI anchors, hashes, and redaction state.
- E4/E5/E6 authorization requires Michael Heller approval unless delegated policy is present.
- OFIF field observations require redaction state and disclosure class.

Exit criteria:

- all examples validate;
- unsafe examples fail;
- CI marks Wargames contract validation passed.

## Phase 2 — Topic and agent contracts

Goal: make the 23-topic map and agent roster machine-readable.

### Schemas

Add:

- `config/schemas/wargames-topic.schema.json`
- `config/schemas/wargames-lsa-lsi-map.schema.json`
- `config/schemas/wargames-agent-role.schema.json`
- `config/schemas/wargames-agent-overlay.schema.json`
- `config/schemas/phase-surface-map.schema.json`

### Examples

Add:

- `examples/scope-d/wargames/wargames-lsa-map.example.json`
- `examples/scope-d/wargames/agent-role-scout.example.json`
- `examples/scope-d/wargames/agent-role-whisper.example.json`
- `examples/scope-d/wargames/topic-overlay-beacon-analyst.example.json`
- `examples/scope-d/wargames/phase-surface-map.example.json`

### CI checks

- Exactly 23 topics.
- Every topic has 10 LSA dimensions.
- Every topic has 11 LSI anchors.
- Anchors use only p2, p3, p5, p7, p11, p13, p17, p19, p23, p29, p31.
- 10-agent corps remains canonical for execution.
- 23-agent overlay cannot grant independent runtime authority.

Exit criteria:

- LSA/LSI map is CI-validated.
- Agent-role examples validate.
- Dashboard can consume topic and agent metadata.

## Phase 3 — Governance and engagement contracts

Goal: make Memphis Rite, dynamic engagement, BridgeMode, and approvals enforceable.

### Schemas

Add:

- `config/schemas/memphis-promotion-gate.schema.json`
- `config/schemas/memphis-authority-tier.schema.json`
- `config/schemas/promotion-pack.schema.json`
- `config/schemas/bridge-mode-gate.schema.json`
- `config/schemas/limit-receipt.schema.json`
- `config/schemas/rollback-drill-proof.schema.json`
- `config/schemas/engagement-action.schema.json`
- `config/schemas/dynamic-engagement-summary.schema.json`

### Examples

Add:

- `examples/scope-d/wargames/promotion-pack-approved.example.json`
- `examples/scope-d/wargames/promotion-pack-denied.example.json`
- `examples/scope-d/wargames/bridge-mode-gate.example.json`
- `examples/scope-d/wargames/limit-receipt.example.json`
- `examples/scope-d/wargames/rollback-drill-proof.example.json`
- `examples/scope-d/wargames/dynamic-engagement-summary.example.json`
- `examples/scope-d/wargames/expired-authorization.example.json`

### CI checks

- BridgeMode requires redaction state, proof refs, and Michael approval until delegated policy exists.
- E4/E5/E6 cannot validate without authorization.
- Rejected, expired, or revoked authorization cannot be used.
- Public/client-facing outputs require disclosure class.
- Promotion packs require proof refs and rollback posture.

Exit criteria:

- approval flow is machine-enforced in examples;
- invalid approval examples fail CI;
- governance claims become testable.

## Phase 4 — OFIF / Orion client access contracts

Goal: make OFIF the first-class client-facing surface.

### Schemas

Add:

- `config/schemas/ofif-field-observation.schema.json`
- `config/schemas/ofif-fused-finding.schema.json`
- `config/schemas/ofif-assurance-packet.schema.json`
- `config/schemas/ofif-field-task.schema.json`
- `config/schemas/ofif-client-access-envelope.schema.json`

### Examples

Add:

- `examples/scope-d/ofif/executive-posture-summary.example.json`
- `examples/scope-d/ofif/operator-fused-finding.example.json`
- `examples/scope-d/ofif/auditor-assurance-packet.example.json`
- `examples/scope-d/ofif/integrator-jsonld-report.example.json`
- `examples/scope-d/ofif/redacted-learning-insight.example.json`

### CI checks

- OFIF outputs must declare client scope, tenant scope, redaction state, confidence, proof refs, source run refs, disclosure class, and retention policy.
- Exercise-derived outputs require authorization refs.
- Client-facing outputs cannot include raw sensitive logs or raw identity joins by default.

Exit criteria:

- OFIF examples validate;
- client access tiers are enforceable;
- OFIF becomes usable as the client-facing delivery contract.

## Phase 5 — Ontogenesis / ATT&CK semantic contracts

Goal: make Wargames semantic reasoning exportable and SHACL-ready.

### Schemas

Add:

- `config/schemas/attack-coverage-claim.schema.json`
- `config/schemas/jsonld-export-envelope.schema.json`
- `config/schemas/ontology-promotion-gate.schema.json`
- `config/schemas/shacl-validation-result.schema.json`

### Examples

Add:

- `examples/scope-d/ontogenesis/attack-coverage-claim.example.json`
- `examples/scope-d/ontogenesis/finding-to-technique.example.json`
- `examples/scope-d/ontogenesis/exercise-to-control-coverage.example.json`
- `examples/scope-d/ontogenesis/negative-evidence-to-gap.example.json`
- `examples/scope-d/ontogenesis/learning-corpus-export.example.json`

### CI checks

- ATT&CK mapping must be coverage/explanation only, not executable procedure.
- Coverage claims require evidence refs and control refs.
- JSON-LD exports require context, type, topic refs, mode, proof refs, and redaction state.
- LEARNING exports require provenance and redaction.

Exit criteria:

- SCOPE-D emits Ontogenesis-ready JSON-LD envelopes;
- Ontogenesis can validate semantic outputs through SHACL in its own repo.

## Phase 6 — MeshRush and HellGraph adapters

Goal: define graph-view and proof-stream handoff contracts.

### Schemas

Add:

- `config/schemas/meshrush-graph-view-export.schema.json`
- `config/schemas/hellgraph-proof-stream.schema.json`
- `config/schemas/er-plus-replay-test.schema.json`

### Examples

Add:

- `examples/scope-d/adapters/meshrush-graph-view.example.json`
- `examples/scope-d/adapters/hellgraph-proof-stream.example.json`
- `examples/scope-d/adapters/er-plus-replay-test.example.json`

### CI checks

- MeshRush export must contain validated graph nodes/edges only.
- HellGraph proof stream must contain ordered events, proof refs, and checkpoint refs where available.
- ER+ replay test must define allowed reorderings and expected state equivalence tolerance.

Exit criteria:

- adapter examples validate;
- adjacent repo integration points are contract-first.

## Phase 7 — Agent-specific contracts

Goal: turn Scout and Whisper from prose to contract-backed agent specs.

### Scout schemas

- `config/schemas/scout-event-ir.schema.json`
- `config/schemas/scout-profile-proof.schema.json`
- `config/schemas/scout-feature-report.schema.json`

### Whisper schemas

- `config/schemas/whisper-config.schema.json`
- `config/schemas/whisper-cloak-proof.schema.json`
- `config/schemas/whisper-policy-diff.schema.json`

### Examples

- `examples/scope-d/agents/scout-event-ir.example.json`
- `examples/scope-d/agents/scout-profile-proof.example.json`
- `examples/scope-d/agents/whisper-config.example.json`
- `examples/scope-d/agents/whisper-cloak-proof.example.json`

### CI checks

- Scout examples cannot include payload bodies, raw tokens, or raw Authorization/Cookie values.
- Whisper examples must include rollback posture for mutating policy diffs.
- Elevated Whisper action requires authorization ref.

Exit criteria:

- Scout and Whisper are schema-backed, example-backed, and CI-validated.

## Phase 8 — Surface-specific contracts

Goal: capture non-network surfaces as first-class schema-backed areas.

### Font/rendering schemas

- `config/schemas/font-observation.schema.json`
- `config/schemas/font-profile.schema.json`
- `config/schemas/font-policy-pack.schema.json`
- `config/schemas/font-swap-proof.schema.json`
- `config/schemas/font-detector-thresholds.schema.json`

### Public-index exposure schemas

- `config/schemas/public-index-exposure-query.schema.json`
- `config/schemas/public-index-exposure-finding.schema.json`

### Examples

- `examples/scope-d/surfaces/font-load-boundary-event.example.json`
- `examples/scope-d/surfaces/font-sanitizer-finding.example.json`
- `examples/scope-d/surfaces/public-index-exposure-authorized-query.example.json`
- `examples/scope-d/surfaces/public-index-exposure-finding.example.json`

### CI checks

- Font examples must be benign or synthetic.
- Public-index exposure examples require owned/authorized scope.
- No example may contain live credential material.

Exit criteria:

- surfaces become first-class, validated parts of Wargames.

## Phase 9 — HPST and verifier economy

Goal: make agent grading, verifier tasks, and promotion evidence contract-backed.

### Schemas

- `config/schemas/hpst-basis.schema.json`
- `config/schemas/hpst-probe-set.schema.json`
- `config/schemas/agent-gradecard.schema.json`
- `config/schemas/verifier-microtask.schema.json`
- `config/schemas/verifier-reward-receipt.schema.json`

### Examples

- `examples/scope-d/hpst/hpst-basis.example.json`
- `examples/scope-d/hpst/probe-set.example.json`
- `examples/scope-d/hpst/agent-gradecard.example.json`
- `examples/scope-d/hpst/verifier-microtask.example.json`

### CI checks

- Gradecards require evidence refs.
- Microtasks must not require unsafe activity.
- Reward receipts must include proof refs and resource accounting.

Exit criteria:

- HPST supports promotion/review without relying on prose.

## Phase 10 — Dashboard and commander view

Goal: expose validated state, not raw prose.

Minimum panels:

- Wargames mode;
- H1–H7 surface coverage;
- V1–V7 phase state;
- agent status;
- proof status;
- boundary-event findings;
- TLI/RWI;
- BridgeMode eligibility;
- engagement ladder state;
- Michael approval status;
- LSA/LSI topic coverage;
- Ontogenesis semantic validation;
- OFIF client-output readiness.

Implementation rule:

Dashboards consume schemas/examples and validated run artifacts. They do not parse prose docs as source of truth.

## First implementation PR recommendation

After the capture PR merges, open a second PR:

`Implement Wargames boundary-event contract slice`

Contents:

- `wargames-mode.schema.json`
- `boundary-event.schema.json`
- `evidence.schema.json`
- `negative-evidence.schema.json`
- `scout-profile-proof.schema.json`
- examples for each;
- validator wiring;
- safety invariants.

This is the smallest high-value slice that turns Wargames from prose into enforceable contracts.

## Do-not-claim list

Until schemas/examples/CI/runtime adapters exist, do not claim:

- Wargames agents run;
- MeshRush consumes Wargames graph views;
- HellGraph replays Wargames proof streams;
- Ontogenesis validates Wargames JSON-LD;
- OFIF exposes Wargames field intelligence;
- Scout or Whisper are deployed;
- FROST promotion is operational;
- BridgeMode is implemented;
- dynamic engagement approval is CI-enforced;
- LSA/LSI is computed from live corpora;
- dashboard/commander view exists.

## Completion definition

This backlog is complete when every Wargames doctrine element is either:

- schema-backed;
- example-backed;
- CI-validated;
- linked to an owning adjacent repo;
- or consciously deferred with reason.

This backlog does not implement runtime behavior by itself. It defines the implementation path.
