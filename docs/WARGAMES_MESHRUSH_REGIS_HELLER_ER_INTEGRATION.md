# Wargames Integration: MeshRush, Regis Entity Graph, and Heller ER

Status: v0.1 reconciliation baseline  
Owner plane: SCOPE-D / Devine Intelligence Wargames integration architecture  
Related repos: `SocioProphet/meshrush`, `SocioProphet/regis-entity-graph`, `SocioProphet/identity-is-prime-reference`, `SocioProphet/hellgraph`  
Boundary: cyber defense, graph runtime, evidence geometry, identity-aware governance, and replay invariants

## Purpose

This document reconciles Devine Intelligence Wargames with MeshRush, Regis Entity Graph, Identity Is Prime, and the Heller ER / HellGraph lineage.

Important correction: **SCOPE-D Wargames is a cyber defense system. Prime-identity constraints do not block authorized defensive correlation.** They govern privacy, disclosure, learning-corpus reuse, publication, and non-defense identity-product behavior.

`mdheller/DeepER` is not the anchor for this integration.

## Integration anchors

### MeshRush

MeshRush is the graph-operating runtime for graph-native agents over typed hypergraph world-model views. It provides traversal, diffusion, stopping, crystallization, artifact reuse, and evidence/learning surfaces.

SCOPE-D relation:

- SCOPE-D Wargames emits validated evidence and boundary-event graph views.
- MeshRush traverses and operates over those graph views.
- SCOPE-D remains the defensive validation and gate layer.

### Regis Entity Graph

Regis carries the prime-identity idea: identity is a product of irreducible role topics, and ordinary systems should not silently collapse those roles across scopes.

SCOPE-D relation:

- Regis informs identity-aware governance and disclosure.
- Regis helps prevent unsafe publication or learning reuse of cross-scope human identity joins.
- Regis does not prevent authorized security work from correlating evidence within a defensive investigation or protected environment.

### Identity Is Prime Reference

Identity Is Prime is the concrete executable reference for prime-topic labeling, Event-IR ingestion, fog-first scope labels, explainable entity-resolution outputs, policy-veto examples, congruence evidence, and proof artifacts.

SCOPE-D relation:

- It is the prime-identity implementation anchor.
- It should inform redaction, publication, BridgeMode, and LEARNING-mode corpus controls.
- DEFENSE mode may still correlate authorized security evidence across identity, device, service, session, and graph scopes when needed.

### HellGraph / Heller ER lineage

HellGraph is a local-first runtime scaffold for field-calculus-driven evidence, proof, journaling, checkpointing, replay, and read-side incident inspection.

SCOPE-D relation:

- HellGraph is the local-first persistence and replay sibling.
- Wargames should emit evidence and proof streams compatible with journaling, checkpointing, replay, and later inspection.
- ER+ confluence and replay tests belong in this lane.

## Corrected architecture

```text
SCOPE-D Wargames
  defensive validation, exercises, proofs, safety gates, mode switch
        |
        v
Boundary Cyber Hypergraph
  Component -> Port -> Contract -> BoundaryEvent -> Evidence/Finding/Artifact
        |
        v
MeshRush
  graph traversal, diffusion, stopping, crystallization, reuse
        |
        v
HellGraph / Heller ER lineage
  proof artifacts, atoms, journal, checkpoint, replay
        |
        v
Regis / Identity Is Prime
  identity-aware disclosure, prime-topic governance, publication controls
```

Regis is not placed above the defensive evidence layer because it must not veto authorized defense correlation. It governs disclosure and identity-product behavior after defensive evidence has been handled under scope, policy, and audit.

## Defense-first rule

Inside an authorized defensive scope, SCOPE-D may correlate relevant security evidence when needed for detection, triage, containment, recovery, proof, or review.

The controlling constraints are:

- authorization;
- purpose limitation;
- tenant isolation;
- auditability;
- minimization where feasible;
- redaction for downstream disclosure;
- policy gates for mutation;
- retention discipline;
- no misuse outside defensive scope.

They are not prime-identity separation constraints.

## Where prime identity applies

Prime identity applies to:

1. public or customer-facing reports;
2. reusable LEARNING-mode corpora;
3. BridgeMode diffusion;
4. non-defense identity product behavior;
5. governance review of sensitive disclosure.

Prime identity does not apply as a blocker to authorized defensive correlation.

## Crosswalk

| Wargames layer | MeshRush | HellGraph / ER+ | Regis / Identity Is Prime |
|---|---|---|---|
| BoundaryEvent | Graph-view input | Journaled event/atom | Optional identity-topic context |
| Contract | Traversal/admission constraint | Field-pack constraint | Disclosure and purpose context |
| Evidence | Trace / learning surface | Proof artifact / valuation | Redaction and release context |
| Finding | Local structure requiring action | Incident-link inspection | Sensitive-output marker |
| Topic p2..p31 | Graph anchor labels | Basis / field-pack coordinates | Prime-topic labels when identity-bearing |
| DEFENSE mode | Graph validation and traversal | Replayable defensive proofs | No block on authorized correlation |
| LEARNING mode | Learning surface over graph views | Reproducible experiment memory | Preserve identity-topic boundaries |
| BridgeMode | Controlled diffusion | Proof-leaf persistence | No raw cross-scope identity publication by default |

## ER+ integration requirements

ER+ should provide disciplined identity and entity dynamics:

- record edit reachability;
- entity move reachability;
- directed path costs rather than overclaimed metrics;
- local expansion diagnostics for ambiguous identity neighborhoods;
- behavioral trajectory features;
- confluence and replay tests for admissible event reorderings.

In DEFENSE mode, ER+ supports authorized correlation and replay. In LEARNING, PUBLICATION, or BRIDGE mode, identity-topic boundaries guide redaction and aggregation.

## Required SCOPE-D follow-ups

Docs:

- `IDENTITY_GEOMETRY_ER_PLUS_ALIGNMENT.md`;
- update `BOUNDARY_CYBER_HYPERGRAPH_ALIGNMENT.md` with optional identity-topic context;
- update `WARGAMES_MODE_SWITCH.md` so LEARNING mode preserves identity boundaries without constraining DEFENSE mode.

Future schemas:

- `identity-topic-context.schema.json`;
- `identity-disclosure-boundary.schema.json`;
- `defense-correlation-authority.schema.json`;
- `er-plus-replay-test.schema.json`;
- `meshrush-graph-view-export.schema.json`.

Future examples:

- boundary event with optional identity-topic context;
- authorized defensive correlation with audit metadata;
- redacted public report preserving identity-topic boundaries;
- MeshRush graph-view export from Wargames evidence;
- ER+ replay/confluence test;
- BridgeMode proof-leaf export with no raw identity disclosure.

## Completion definition

This integration is complete when SCOPE-D can:

1. emit boundary hypergraph slices suitable for MeshRush;
2. keep defense correlation authority separate from disclosure restrictions;
3. attach optional identity-topic context where useful;
4. preserve ER+ replay and confluence metadata;
5. persist proof/event streams in a HellGraph-compatible shape;
6. enforce identity-aware disclosure controls before publication, LEARNING reuse, or BridgeMode diffusion.
