# Identity Geometry / ER+ Alignment

Status: v0.1 canonical capture  
Canonical program: Devine Intelligence Wargames  
Related work: Heller ER / ER+ identity geometry, Regis Entity Graph, Identity Is Prime, HellGraph  
Owner plane: entity dynamics, identity evidence geometry, replay/confluence, disclosure-aware governance  
Implementation state: prose capture only; schema/example/CI backlog

## Purpose

This document aligns the ER+ / Heller ER identity-geometry work with Devine Intelligence Wargames.

ER+ treats records and entities as states in a governed transition system. The allowed transformations of that system define an intrinsic geometry over identity evidence: record edits, entity moves, behavioral trajectories, local expansion diagnostics, and replay/confluence invariants.

In SCOPE-D Wargames, ER+ is an adjacent identity and entity-dynamics layer. It is valuable for:

- identity evidence modeling;
- replay and confluence tests;
- entity movement and merge/split review;
- behavioral anomaly features;
- HellGraph-compatible event replay;
- Regis / Identity Is Prime disclosure governance;
- SynapseIQ enrichment and quality signals;
- OFIF assurance and audit summaries.

Critical correction:

> ER+ and prime-identity constraints do not block authorized cyber-defense correlation inside approved scope. They govern state modeling, replayability, disclosure, learning reuse, auditability, and identity-product behavior.

## Scope

This alignment covers:

- record edit geometry;
- entity move geometry;
- directed path costs;
- reachability diagnostics;
- finite-graph expansion features;
- behavioral delay-coordinate features;
- event-state transitions;
- neutrality/confluence replay tests;
- disclosure-aware identity handling;
- Wargames BoundaryEvent integration;
- HellGraph replay compatibility.

It does not authorize:

- production identity merges without policy;
- irreversible identity collapse;
- client-facing raw identity joins by default;
- use of identity-prime separation to block defensive correlation;
- punitive automated identity decisions without policy approval;
- unreviewed model-driven enforcement.

## Core ER+ statement

Records and entities are states in a governed transition system. The allowed transformations of the system define its intrinsic geometry.

At the record level, atomic edit generators induce a record path cost.

At the entity level, membership, merge, split, reassignment, and posterior-update moves induce an entity path cost.

These path costs are not automatically metrics. They are directed, state-dependent, sometimes partial, and operationally calibrated.

Finite-graph local expansion exponents provide scale-dependent ambiguity diagnostics, not literal fractal dimensions.

Delay-coordinate behavioral features convert event streams into trajectory representations. They are Takens-inspired features, not claims of full dynamical reconstruction.

Neutrality is not assumed. It is tested through admissible event reorderings, replay, and state-equivalence checks.

## Record state space

A record is a partial attribute map over a declared schema.

Examples:

- name;
- date of birth;
- phone;
- email;
- device identifier;
- account identifier;
- session identifier;
- address;
- organization;
- source-specific field.

Records are normalized through canonicalization.

```text
C : R -> R_C
```

The comparison target is not always exact equality. It may be:

- canonical equality;
- approximate canonical agreement;
- declared equivalence under a policy relation.

This prevents the system from pretending that messy production identity data can always be converted into exact symbolic equality.

## Atomic record edit algebra

For each attribute, define attribute-level edit generators.

Examples:

- nickname expansion;
- keyboard typo;
- transliteration;
- locale-specific date format;
- phone normalization;
- address standardization;
- OCR confusion;
- source-specific canonicalization.

A record edit path is a composition of admissible generators.

Operational interpretation:

> Two records are close when one can be transformed into the other, up to canonicalization and declared equivalence, by a low-cost sequence of plausible edits.

## Reachability, not overclaimed controllability

The framework uses record reachability and entity reachability, not unqualified controllability.

Record reachability:

```text
r ~> r' if an admissible edit path transforms r into canonical agreement with r'
```

Entity reachability:

```text
e ~> e' if an admissible entity-move path transforms e into an equivalent target state
```

Low reachability is diagnostic. It suggests missing edit generators, incomplete source modeling, or insufficient entity-move coverage.

## Directed path costs

Each edit or entity move receives a cost.

Recommended interpretation:

- common transformations are cheap;
- rare transformations are expensive;
- disallowed transformations are infinite or invalid;
- state-dependent moves account for posterior surprise, conflict, and policy penalties.

Record path cost:

```text
D_R(r, r') = least admissible edit cost from r to r'
```

Entity path cost:

```text
D_E(e, e') = least admissible entity-move cost from e to e'
```

Do not call these true metrics unless the stronger assumptions hold:

- inverse generators exist;
- inverse costs are symmetric;
- reachable component is connected;
- zero-cost paths imply equivalence;
- identity has zero cost.

In production defense and identity systems, directed path costs are usually the correct object.

## Match score and posterior discipline

Path costs are features, not automatic posterior probabilities.

A record score may be shaped like:

```text
s_R = exp(-lambda_R * D_R)
```

An entity score may be shaped like:

```text
s_E = exp(-lambda_E * D_E)
```

These scores should feed calibrated models with additional evidence:

- source reliability;
- quality/completeness;
- policy context;
- behavioral evidence;
- graph evidence;
- base rates;
- review status.

This preserves the energy/path-cost intuition without pretending that an unnormalized cost is already a posterior probability.

## Entity state space

A resolved entity is a state object:

```yaml
entity:
  entityId: string
  recordIds: []
  records: []
  summaryState: {}
  posteriorState: {}
  auditHistory: []
```

The summary state may contain:

- canonical name distribution;
- address posterior;
- phone/email posterior;
- device/account/payment instruments;
- graph relationships;
- source trust weights;
- risk features;
- audit events.

ER+ should preserve distributions when evidence is ambiguous instead of collapsing too early to a single golden record.

## Entity move algebra

Entity moves include:

- add record;
- drop record;
- reassign record;
- merge entities;
- split entity;
- posterior refresh;
- source-prior update;
- policy-state update;
- manual adjudication.

Each move is governed, costed, and replayable.

Potential move shape:

```yaml
kind: EntityMove
moveId: string
moveType: add_record | drop_record | reassign_record | merge_entities | split_entity | posterior_refresh | policy_update | manual_adjudication
beforeStateRef: string
afterStateRef: string
recordRefs: []
entityRefs: []
cost:
  value: number
  components: {}
policyRefs: []
proofRefs: []
reviewRefs: []
```

## Local expansion exponent

The earlier fractal language is treated as intuition only. The production object is a finite-graph local expansion diagnostic.

For an entity, count nearby entities under the entity path cost at increasing radii.

Interpretation:

- high local expansion: dense ambiguity, shared identifiers, household clusters, business clusters, synthetic-fabric risk, or over-merged regions;
- low local expansion: sparse neighborhood, clean uniqueness, or artificial isolation;
- volatile expansion: ingestion drift, source-quality changes, attack behavior, or policy changes.

This diagnostic should be monitored by:

- segment;
- source;
- region;
- product;
- time window;
- tenant where appropriate.

It is not a literal Hausdorff or fractal dimension claim.

## Behavioral delay-coordinate features

For an entity event stream, construct behavioral trajectory fragments from event observables.

Observables may include:

- device fingerprint;
- login region;
- merchant category;
- transaction type;
- account action;
- source identifier;
- graph-neighborhood summary;
- record-quality vector;
- learned embedding.

For sparse and irregular production data, use:

- event-count windows;
- wall-clock windows;
- learned time buckets;
- masking for missing observations;
- segment-specific parameters;
- minimum-event thresholds.

These are Takens-inspired delay features, not full reconstruction guarantees.

## Behavioral similarity and anomaly features

Behavioral point clouds can support:

- entity similarity;
- account takeover review;
- synthetic identity review;
- ingestion drift review;
- unusual but legitimate life-event review;
- risk routing.

Anomaly scores should feed review and risk workflows, not automatic punitive decisions unless policy permits.

## Event dynamics

The global ER+ state can be represented as:

```yaml
erPlusState:
  records: []
  entities: []
  graph: {}
  modelParameters: {}
  policyState: {}
  auditLedger: []
```

Incoming events induce transitions:

- insert record;
- update record;
- delete or retract record;
- merge candidate;
- split candidate;
- source-prior update;
- policy update;
- manual adjudication;
- model-version update.

Each transition should decompose into declared record edits, entity moves, and ledger updates.

## Neutrality as confluence invariant

Neutrality is a testable confluence invariant.

Given an event sequence and an admissible reordering that preserves causal dependencies, replay both and compare final states.

A test passes when final states are equivalent within tolerance.

Comparison dimensions:

- entity membership;
- posterior summaries;
- decision labels;
- risk labels;
- audit ledger hashes;
- proof refs;
- disclosure state.

Neutrality is enforced through regression tests, not assumed.

## Boundary Cyber Hypergraph integration

ER+ consumes and emits Boundary Hypergraph facts.

BoundaryEvent roles:

- `authenticate`;
- `token_issue`;
- `token_use`;
- `connect`;
- `request`;
- `file_read`;
- `file_write`;
- `document_open`;
- `sensor_access`;
- `config_change`;
- `module_load`.

ER+ should link entity transitions to:

- evidence refs;
- boundary event refs;
- negative evidence refs;
- findings;
- proof artifacts;
- replay tests.

## Defense correlation rule

SCOPE-D Wargames is a cyber defense system.

Inside authorized defensive scope, evidence correlation across accounts, devices, sessions, services, artifacts, and identity providers is permitted when necessary for detection, triage, containment, recovery, proof, or review.

ER+ does not block this.

ER+ adds:

- auditability;
- replayability;
- cost explanations;
- uncertainty preservation;
- confluence testing;
- disclosure-aware output boundaries.

## Regis / Identity Is Prime relation

Regis and Identity Is Prime govern identity-aware disclosure and learning reuse.

They apply to:

- public reports;
- client-facing summaries;
- reusable learning corpora;
- BridgeMode proof-leaf diffusion;
- non-defense identity products;
- cross-scope personhood disclosure.

They do not block authorized defensive correlation inside approved scope.

## HellGraph relation

HellGraph is the natural local-first replay and proof persistence sibling.

ER+ should export:

- event transition logs;
- entity move records;
- proof refs;
- checkpoint refs;
- replay test manifests;
- confluence results.

HellGraph can journal, checkpoint, replay, and inspect these transitions.

## MeshRush relation

MeshRush consumes graph views. ER+ can provide entity graph slices and ambiguity neighborhoods as graph views.

MeshRush should not become the identity policy authority. It traverses validated graph views produced by SCOPE-D and related layers.

## SynapseIQ relation

SynapseIQ can enrich ER+ outputs:

- entity ambiguity diagnostics;
- expansion scores;
- behavioral anomaly summaries;
- replay/confluence status;
- disclosure readiness;
- OFIF-ready summaries.

SynapseIQ activation should respect redaction, disclosure class, and authorization state.

## OFIF / Orion relation

OFIF may expose ER+ insights only in client-appropriate form.

Allowed OFIF outputs:

- entity ambiguity summary;
- evidence-backed correlation explanation;
- replay/confluence assurance;
- redacted behavioral anomaly summary;
- reviewer-ready identity-risk note.

Not exposed by default:

- raw identity joins;
- raw sensitive records;
- raw behavioral traces;
- unsupported model conclusions.

## Required schemas

Future schemas:

- `record-edit-registry.schema.json`;
- `entity-move-registry.schema.json`;
- `entity-path-cost.schema.json`;
- `local-expansion-diagnostic.schema.json`;
- `behavioral-delay-feature.schema.json`;
- `er-plus-replay-test.schema.json`;
- `er-plus-confluence-result.schema.json`;
- `entity-disclosure-boundary.schema.json`.

## Required examples

Future examples:

- record edit registry;
- entity move registry;
- merge candidate with policy review;
- split candidate with proof refs;
- confluence replay test;
- local expansion diagnostic;
- behavioral anomaly review;
- OFIF redacted entity ambiguity summary;
- HellGraph replay manifest.

## CI checks

Required CI checks:

- path costs must not be labeled as calibrated probabilities;
- replay tests must define allowed reorderings and tolerance;
- confluence results must include final-state comparison fields;
- disclosure outputs must declare redaction state;
- client-facing outputs must not include raw identity joins by default;
- defense-correlation examples must declare authorization scope;
- policy-veto examples must specify whether they apply to defense, disclosure, learning, or product behavior.

## Completion definition

ER+ identity geometry is implementation-backed only when schemas, examples, replay tests, confluence tests, disclosure boundaries, and adapter examples exist.

Until then, this document is canonical prose capture, not runtime implementation.
