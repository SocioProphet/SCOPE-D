# Memphis Rite Governance

Status: v0.1 canonical capture  
Canonical program: Devine Intelligence Wargames  
Owner plane: promotion, halt, bridge, authority, proof, and approval governance  
Implementation state: prose capture only; schema/example/CI backlog

## Purpose

The Memphis Rite is the governance spine for Devine Intelligence Wargames. It defines how agents, exercises, claims, policies, bridge actions, dynamic engagement, and client-facing releases are tested, promoted, halted, reverted, and sealed.

The Rite is operational governance, not mysticism. It binds privileges to proof, promotion to quorum, diffusion to disclosure controls, and elevated engagement to explicit approval.

## Core covenant

All Wargames governance inherits these rules:

- SCOPE-D Wargames is a cyber defense system.
- Authorized defensive correlation is permitted inside approved defensive scope.
- Dynamic engagement is evidence-gated, proportional, auditable, and approval-bound.
- Identity-prime constraints govern disclosure and learning reuse, not authorized defensive triage.
- Offensive or adversary-emulation behavior is allowed only as approved, scoped, evidence-gated exercise work.
- E4/E5/E6 engagement, BridgeMode, sensitive release, policy exceptions, and scope expansion require Michael Heller signoff until a replacement delegated policy is approved.
- Nothing advances without proof.
- Nothing sensitive diffuses without redaction and authorization.
- Nothing permanent proceeds without rollback posture where rollback is technically possible.

## Safety envelope

### Alpha-bound

Agent actions must remain inside the declared alpha-bound safety envelope:

- micro: epsilon effective at or below alpha;
- meso: at or below two alpha unless explicitly justified;
- macro: median at or below three alpha and P95 at or below four alpha.

Alpha is a governance budget, not a physical claim in this repo.

### Octonion boundary axes

The eight boundary axes are:

1. legality;
2. containment;
3. provenance;
4. privacy;
5. performance;
6. reproducibility;
7. licensing;
8. governance.

Any axis at or above threshold triggers LIMIT or review according to severity.

### FPGL flow

FPGL is the control law:

- ACCUM: observe and gather facts;
- ALIGN: damp, diffuse, squeeze, compress, or correct;
- LIMIT: freeze, halt, isolate, or revert.

The Rite defines when FPGL applies and who may authorize escalation or release.

## Authority tiers

| Tier | Title | Prime marker | Allowed phases | Special powers |
|---:|---|---|---|---|
| I | Apprentice | p2 | V1–V2 | read-only collection and local proof prep |
| II | Adept | p11 | V1–V4 | synthetic drill proposal and lab validation |
| III | Guardian | p13 | V1–V6 | policy review, redaction review, halt recommendation |
| IV | Preceptor | p17 | V1–V7 | promotion proposal with quorum |
| V | Grand Hierophant | p23 | V1–V7 | BridgeMode recommendation with gates |

## Temporary approval authority

Until a delegated policy exists, overall signoff belongs only to Michael Heller for:

- E4 controlled engagement inside the boundary;
- E5 outside-boundary coordination;
- E6 adversary-emulation, red-team, purple-team, tabletop, or synthetic offensive-simulation exercises;
- BridgeMode enablement;
- public, client-facing, or sensitive release of Wargames-derived intelligence;
- policy exceptions;
- scope expansion;
- authority expansion;
- any action that changes blast radius, disclosure posture, or external coordination posture.

No agent, automation, committee, inferred policy, or substitute approver can override this rule until a replacement governance policy is explicitly approved.

## Seven-phase cadence

The Memphis Rite governs the seven Wargames phases:

1. V1 Observe;
2. V2 Profile;
3. V3 Cloak / Guard;
4. V4 Swap / Synthetic Adversarial Validation;
5. V5 ALIGN;
6. V6 Train / Grade / Seal;
7. V7 Convene / Promote / Bridge.

The phases operate across seven surfaces:

- H1 Mobile;
- H2 Network;
- H3 Host;
- H4 Browser;
- H5 Cloud;
- H6 Storage;
- H7 Boot / Attestation.

## Promotion ceremony

Promotion means a claim, policy, agent, threshold, topic, report, or exercise result advances in authority or canon status.

### Required inputs

A promotion package must include:

- candidate identifier;
- phase history;
- scope definition;
- evidence refs;
- proof refs;
- safety-boundary refs;
- redaction state;
- rollback posture;
- current risk state;
- responsible owner;
- quorum requirement;
- approval requirement;
- expiration or review window where appropriate.

### Steps

1. Herald declares readiness and enumerates H1–H7 surface state.
2. Scribe reads proof inventory and hash state.
3. Warden performs Octonion boundary review.
4. Veil performs privacy, DLP, and TLI/RWI review where relevant.
5. Candidate presents Event-IR and ProofArtifact trail.
6. Required witnesses review evidence.
7. FROST or quorum bundle is assembled where required.
8. Michael Heller signoff is required if the action falls under the temporary approval authority rule.
9. Scribe seals the minutes, hashes, SBOM refs, and promotion receipt.
10. Herald routes the result to dashboard, OFIF, Ontogenesis, MeshRush, HellGraph, or Bridge-Steward as appropriate.

## Functional oath

The operational oath is neutral and technical:

> I accept powers narrowly tailored to my office. I will keep provenance complete, act within declared safety boundaries, and submit to LIMIT on breach. I will not feign, tamper, conceal, or expand scope silently. I will prefer clarity to cleverness, proofs to promises, and reversal over persistence when safety is in doubt.

## Halt and LIMIT authority

LIMIT may be triggered by:

- safety-boundary breach;
- missing proof for promoted action;
- unapproved scope expansion;
- evidence contradiction;
- TLI/RWI threshold failure;
- redaction failure;
- unauthorized elevated engagement;
- drift against SPEC;
- outside-boundary action without lawful approval path;
- missing Michael signoff where required.

Warden and Herald may initiate halt routing. Michael Heller approval is required for overriding a halt in any elevated or sensitive lane until delegated policy exists.

## BridgeMode governance

BridgeMode allows controlled proof-leaf diffusion or client-facing publication through governed channels.

### Bridge gates

All gates must be green:

- evidence refs present;
- proof refs present;
- redaction state acceptable;
- no raw sensitive identity joins by default;
- TLI below configured threshold;
- RWI below configured threshold;
- alpha and Octonion axes green;
- quorum recorded where required;
- Michael Heller signoff until delegated policy exists;
- OFIF disclosure class declared if client-facing;
- Ontogenesis semantic validation where ontology-backed.

### Bridge outputs

- `bridge.enable.proof.json`;
- proof-leaf bundle;
- redaction receipt;
- disclosure classification;
- OFIF summary where applicable;
- HellGraph replay refs where applicable.

## Simulated failure and rollback rite

The historical corpus uses “death rite” language. In SCOPE-D this is represented as simulated failure and rollback training.

Purpose:

- teach agents and operators to fail safely;
- verify LIMIT routing;
- verify rollback;
- measure detection latency;
- record lessons learned.

Allowed benign simulations:

- missing proof;
- contradictory Omega score;
- forged-looking but inert header shape;
- safe missing-record negative-evidence case;
- benign policy drift fixture;
- synthetic unavailable sensor case.

Disallowed:

- destructive payloads;
- credential collection;
- unauthorized external action;
- live exploit behavior;
- unapproved offensive action.

Required outputs:

- `rollback.drill.proof.json`;
- `lesson.learned.json`;
- `limit.receipt.json`;
- updated guardrail or backlog item.

## Dynamic engagement relation

The Memphis Rite binds directly to `WARGAMES_DYNAMIC_ENGAGEMENT_POLICY.md`.

- E0/E1 may proceed automatically inside authorized scope when read-only or preservation-only.
- E2/E3 require policy gate and rollback posture.
- E4/E5/E6 require explicit authorization and Michael Heller signoff until delegated policy exists.

Engagement outputs must include:

- trigger ref;
- evidence refs;
- authorization ref where required;
- action summary;
- proof receipt;
- closure or rollback state.

## OFIF / Orion relation

OFIF is the client-facing field-intelligence surface.

The Rite governs what can flow to OFIF:

- executive summaries;
- fused findings;
- assurance packets;
- field tasks;
- dynamic engagement summaries;
- approved remediation plans.

OFIF outputs must declare:

- tenant scope;
- client scope;
- redaction state;
- disclosure class;
- confidence;
- proof refs;
- authorization refs where exercise-derived or engagement-derived.

## Ontogenesis / ATT&CK relation

Ontogenesis supplies semantic validation and ATT&CK understanding.

The Rite governs semantic promotion:

- ontology module changes require validation;
- ATT&CK coverage claims require evidence refs;
- public or client-facing semantic outputs require redaction and disclosure classification;
- technique mappings must remain defensive coverage, not operational procedure instructions.

## MeshRush / HellGraph relation

MeshRush consumes graph views after SCOPE-D validation.

HellGraph preserves proof/event streams for replay, checkpointing, and inspection.

The Rite requires:

- graph-view export refs;
- proof-stream refs;
- replay or checkpoint refs where available;
- no hidden authority expansion through graph traversal.

## Regis / Identity Is Prime relation

Regis and Identity Is Prime govern identity-aware disclosure and learning reuse.

They do not block authorized cyber defense correlation inside approved scope.

They do apply to:

- client-facing reports;
- public release;
- BridgeMode;
- reusable learning corpora;
- non-defense identity products;
- cross-scope personhood disclosures.

## Clip-ready checklists

### Promotion readiness

- [ ] V1–V6 proofs present where required.
- [ ] Evidence refs present.
- [ ] Safety boundary green.
- [ ] Octonion axes below threshold.
- [ ] Redaction state declared.
- [ ] TLI/RWI checked where publication or bridge is involved.
- [ ] Drift guard passes where applicable.
- [ ] Rollback posture present.
- [ ] Quorum or witness requirements satisfied.
- [ ] Michael Heller signoff present where required.

### BridgeMode readiness

- [ ] Proof leaves only.
- [ ] No raw sensitive identity joins by default.
- [ ] Redaction receipt present.
- [ ] TLI/RWI green.
- [ ] Alpha and axes green.
- [ ] Ontogenesis validation present where semantic output is involved.
- [ ] OFIF disclosure class declared where client-facing.
- [ ] Michael Heller signoff present until delegated policy exists.

### Dynamic engagement readiness

- [ ] Engagement trigger exists.
- [ ] Evidence refs exist.
- [ ] Boundary scope declared.
- [ ] Engagement level declared.
- [ ] Authorization object exists for E4/E5/E6.
- [ ] Michael Heller signoff exists for E4/E5/E6 until delegated policy exists.
- [ ] Rollback or closure path declared.
- [ ] Proof receipt path declared.

## Required follow-ups

Schemas:

- `memphis-promotion-gate.schema.json`;
- `memphis-authority-tier.schema.json`;
- `bridge-mode-gate.schema.json`;
- `limit-receipt.schema.json`;
- `rollback-drill-proof.schema.json`;
- `promotion-pack.schema.json`.

Examples:

- normal promotion pack;
- denied promotion pack;
- BridgeMode enablement pack;
- LIMIT receipt;
- rollback drill proof;
- dynamic engagement authorization pack.

CI checks:

- promotions require proof refs;
- BridgeMode requires redaction and Michael signoff until delegated policy exists;
- E4/E5/E6 requires authorization;
- public/client-facing outputs require disclosure class;
- rejected or expired approvals cannot be used.

## Completion definition

Memphis Rite governance is implementation-backed only when schemas, examples, CI validation, proof/receipt shapes, dashboard state, and approval-flow checks exist.

Until then, this document is canonical governance capture, not runtime implementation.
