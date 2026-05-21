# Devine Intelligence Wargames — Runtime Layer Architecture

Status: captured architecture replay  
Source: closed/unmerged PR #11, replayed to prevent loss  
Implementation state: architecture only; no runtime behavior implemented

## Purpose

This document captures the first runtime-layer architecture specification for Devine Intelligence Wargames.

It exists because the runtime architecture was described in a closed, unmerged pull request. The PR had no committed file changes, so its recoverable content lived only in the PR body. This document replays that content into the repository as captured architecture.

## Boundary

This document adds no runtime code, agents, collectors, adapters, replay engine, graph traversal, client delivery, telemetry ingestion, engagement execution, or offensive workflow.

It specifies the guardrail architecture future runtime work must follow before any agent, adapter, export, delivery, replay, or engagement path can execute.

## Key rule

No Wargames capability may execute unless its invocation envelope resolves to an allowed contract state.

The runtime layer must consult the contract stack before execution. Prose doctrine, inferred intent, or an agent role name is not sufficient authorization.

## Invocation envelope

Every attempted runtime action should be wrapped in an invocation envelope before execution.

Minimum fields:

```yaml
kind: WargamesInvocationEnvelope
invocationId: string
requestedAt: string
requestedBy: string
capabilityClass: observe_profile | validate | export | enrich | activate_deliver | engage | graph_view | replay
mode: DEFENSE | LEARNING
surfaceRefs: []
phaseRefs: []
topicRefs: []
sourceRunRefs: []
evidenceRefs: []
proofRefs: []
contractRefs: []
authorizationRefs: []
redactionState: redacted | synthetic | withheld
clientScope: string | null
tenantScope: string
requestedAction: string
runtimeTargetRef: string | null
```

The envelope is the unit passed to the contract resolver and policy evaluator.

## Contract resolver responsibilities

The contract resolver maps an invocation envelope to the relevant schemas, examples, proofs, and prior receipts.

Responsibilities:

- resolve Wargames mode contracts;
- resolve BoundaryEvent / Evidence / NegativeEvidence refs;
- resolve Scout proof refs;
- resolve engagement trigger / authorization refs;
- resolve LSA/LSI topic-map refs;
- resolve OFIF / SynapseIQ activation refs;
- resolve Ontogenesis / ATT&CK export refs;
- resolve MeshRush / HellGraph export refs;
- verify referenced contracts are schema-backed;
- verify required examples and negative fixtures exist for the capability class;
- return a normalized contract state.

The resolver does not authorize execution by itself. It only resolves contract state.

## Policy evaluator responsibilities

The policy evaluator consumes the invocation envelope plus resolved contract state and emits a runtime decision.

Responsibilities:

- apply engagement-policy rules;
- enforce Michael-only E4/E5/E6 approval until delegated policy exists;
- enforce redaction and disclosure constraints;
- enforce no-runtime claims on static exports;
- enforce no raw identity joins by default;
- enforce no public scanning or credential collection unless a future explicit policy allows it;
- enforce runtime boundary by capability class;
- decide allow/block/warn/review/limit state;
- emit a receipt requirement for every decision.

## Runtime decision classes

The runtime layer should use explicit decision classes.

| Decision | Meaning |
|---|---|
| `allow` | The invocation may proceed under the resolved contract state and policy. |
| `hard_block` | The invocation is prohibited and must not execute. |
| `soft_warn` | The invocation may proceed only with warning and receipt. |
| `audit_only` | No runtime action may execute; emit audit/receipt only. |
| `review_required` | Human or governance review is required before execution. |
| `limit` | Freeze, halt, isolate, or revert according to FPGL LIMIT semantics. |

The evaluator should prefer `hard_block` or `review_required` when contract state is incomplete, ambiguous, stale, or contradictory.

## Receipt emission requirements

Every runtime decision must emit a receipt, even when the decision is `hard_block`.

Minimum receipt fields:

```yaml
kind: WargamesRuntimeDecisionReceipt
receiptId: string
invocationId: string
decision: allow | hard_block | soft_warn | audit_only | review_required | limit
reason: string
contractRefs: []
policyRefs: []
evidenceRefs: []
proofRefs: []
authorizationRefs: []
redactionState: string
createdAt: string
```

Receipts become the bridge between runtime attempts and the existing proof/evidence stack.

## Capability-class gates

### observe_profile

Examples:

- Scout observation;
- posture profiling;
- read-only header/handshake feature extraction.

Required gates:

- authorized scope;
- read-only posture;
- safety boundary;
- no payload bodies;
- no credential collection;
- redaction state;
- proof/receipt emission.

### validate

Examples:

- schema validation;
- negative fixture validation;
- synthetic drill validation.

Required gates:

- schema refs;
- expected positive/negative fixture behavior;
- no runtime mutation;
- receipt emission.

### export

Examples:

- Ontogenesis export envelope;
- MeshRush graph-view export;
- HellGraph proof-stream export.

Required gates:

- export contract present;
- static export only unless a future adapter policy explicitly allows runtime;
- no runtime connection;
- no traversal/replay/mutation authority;
- no raw identity joins;
- redaction state.

### enrich

Examples:

- SynapseIQ enrichment record generation.

Required gates:

- enrichment contract present;
- no live lookup by default;
- no model mutation;
- no engagement decision authority;
- explicit non-claims;
- redaction state.

### activate_deliver

Examples:

- OFIF activation envelope;
- future client-facing delivery.

Required gates:

- OFIF activation contract present;
- client scope;
- tenant scope;
- disclosure class;
- redaction state;
- no raw identity joins;
- engagement-ready outputs require approved engagement authorization;
- Michael Heller approval for E4/E5/E6 until delegated policy exists.

### engage

Examples:

- dynamic engagement response;
- adversary-emulation exercise;
- contained response action.

Required gates:

- engagement trigger;
- engagement authorization for E4/E5/E6;
- explicit allowed assets;
- allowed actions;
- prohibited actions;
- rollback plan;
- proof receipt;
- Michael Heller approval until delegated policy exists.

### graph_view

Examples:

- MeshRush graph view handoff.

Required gates:

- validated graph-view export;
- no runtime graph traversal by default;
- no mutation authority;
- redaction state;
- no raw identity joins.

### replay

Examples:

- HellGraph proof-stream replay test.

Required gates:

- proof-stream contract;
- ordered events;
- checkpoint refs;
- replay-test refs;
- no replay execution by default;
- no mutation authority;
- declared replay tolerance.

## Failure-mode taxonomy

Runtime decisions should classify failures.

Recommended failure modes:

- missing contract;
- missing evidence;
- missing proof;
- missing authorization;
- stale authorization;
- denied authorization;
- raw data state;
- raw identity join attempt;
- runtime authority claimed by static export;
- traversal authority claimed by graph export;
- replay execution claimed by proof stream;
- engagement decision claimed by enrichment;
- client delivery without OFIF envelope;
- outside-boundary action without authorization;
- policy ambiguity;
- schema validation failure;
- negative fixture unexpectedly passes.

## Runtime evidence chain

A runtime attempt should produce a chain like:

```text
InvocationEnvelope
  -> ContractResolution
  -> PolicyEvaluation
  -> RuntimeDecisionReceipt
  -> ProofArtifact / RunReceipt
  -> Dashboard / Ontogenesis / SynapseIQ / OFIF only if permitted
```

The chain should preserve the no-runtime boundaries unless the evaluator explicitly returns `allow` under a future runtime policy.

## Recommended first implementation slices

### Slice 1 — Contract resolver only

Implement a resolver that accepts an invocation envelope and returns resolved contract state.

No action execution.

### Slice 2 — Policy evaluator only

Implement evaluator decisions over static test envelopes:

- `allow` for safe synthetic validation;
- `hard_block` for raw identity joins;
- `hard_block` for missing Michael approval on E4/E5/E6;
- `hard_block` for static export claiming runtime authority;
- `review_required` for incomplete evidence.

No action execution.

### Slice 3 — Decision receipt emission

Emit `WargamesRuntimeDecisionReceipt` for each decision.

No action execution.

### Slice 4 — Dry-run harness

Replay static invocation envelopes through resolver/evaluator/receipt emission.

No live agents, no collectors, no adapters, no telemetry ingestion, no client delivery, no graph traversal, no replay execution, and no engagement execution.

## Do-not-claim list

Until runtime implementation exists, do not claim:

- Wargames agents run;
- Scout or Whisper execute;
- contracts are consulted on every tool call;
- runtime dispatch is guarded;
- OFIF delivery executes;
- SynapseIQ enrichment runtime executes;
- Ontogenesis SHACL validation runs;
- MeshRush graph traversal executes;
- HellGraph replay executes;
- dynamic engagement executes;
- live telemetry is ingested.

## Completion definition

This architecture is implemented only when there is a resolver/evaluator/receipt path with schemas, fixtures, negative fixtures, CI validation, and no-op dry-run execution.

Until then, this is captured runtime architecture, not runtime implementation.
