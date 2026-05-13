# Devine Intelligence Wargames — HPST and Verifier Economy

Status: v0.1 canonical capture  
Canonical program: Devine Intelligence Wargames  
Owner plane: agent evaluation, tomography, verifier tasks, human review, rewards, gradecards, and promotion evidence  
Implementation state: prose capture only; schema/example/CI backlog

## Purpose

This document captures Hidden Primally-Spanned Tomography (HPST) and the verifier economy for Devine Intelligence Wargames.

HPST is the evaluation and counter-intelligence layer for agents, tools, detectors, and reasoning workflows. It measures calibration, consistency, grounding, counterfactual robustness, tool discipline, abstention, drift, and overconfidence.

The verifier economy is the human and machine review layer that turns evidence, claims, builds, and agent outputs into reviewed, signed, rewardable work units.

This layer supports promotion governance, FROST claims, OFIF field-intelligence assurance, SynapseIQ enrichment quality, and Ontogenesis semantic validation.

## Scope

HPST and verifier economy covers:

- agent grading;
- detector grading;
- tool discipline;
- proof review;
- build verification;
- claim witness tasks;
- learning-corpus quality checks;
- redaction checks;
- overconfidence detection;
- drift detection;
- promotion-readiness scoring;
- verifier rewards and reputation.

It does not authorize offensive actions, policy changes, BridgeMode, dynamic engagement, or client release. It produces evidence and recommendations only.

## HPST objective

HPST answers:

- Is the agent calibrated?
- Does it know when to abstain?
- Does it preserve grounding?
- Does it use tools correctly?
- Does it remain consistent across paraphrases and reordered evidence?
- Does it resist misleading prompts or bad context?
- Does it drift over time?
- Is it overconfident?
- Is it ready for promotion?

## HPST axis set

Canonical initial axes:

1. calibration;
2. consistency;
3. grounding;
4. counterfactual sensitivity;
5. tool discipline;
6. abstention;
7. drift;
8. provenance fidelity;
9. safety-boundary fidelity;
10. reviewability.

The earlier 6-axis basis is retained as a minimal kernel:

- calibration;
- consistency;
- grounding;
- counterfactual;
- tool;
- abstention.

The 10-axis version is preferred for SCOPE-D Wargames because it adds provenance, safety, drift, and reviewability.

## Probe families

### Calibration probes

Goal: test whether confidence tracks correctness.

Signals:

- confidence/correctness pairs;
- expected calibration error;
- overconfidence index;
- underconfidence index.

### Consistency probes

Goal: test stability across paraphrases, source order, or equivalent evidence.

Signals:

- paraphrase consistency;
- premise-shuffle stability;
- replay consistency;
- contradiction detection.

### Grounding probes

Goal: test whether outputs are tied to evidence.

Signals:

- citation/evidence ref completeness;
- unsupported claim rate;
- hallucination-like unsupported reasoning;
- source mismatch.

### Counterfactual probes

Goal: test sensitivity to meaningful changes.

Signals:

- attribute flip response;
- policy-state flip response;
- evidence-added response;
- evidence-removed response.

### Tool-discipline probes

Goal: test whether tools are used when required and ignored when inappropriate.

Signals:

- required-tool invocation;
- tool-result incorporation;
- tool failure handling;
- refusal to invent tool output.

### Abstention probes

Goal: test whether the agent abstains or routes to review when evidence is insufficient.

Signals:

- abstain-on-uncertainty;
- review escalation;
- unsafe confidence refusal;
- appropriate deferral.

### Drift probes

Goal: detect behavior changes over time.

Signals:

- score movement across windows;
- z-vector drift;
- policy compliance drift;
- topic-anchor drift.

### Provenance probes

Goal: verify preservation of proof and evidence chain.

Signals:

- proof refs present;
- source hashes present;
- redaction state present;
- custody path coherent.

### Safety-boundary probes

Goal: verify compliance with Wargames safety controls.

Signals:

- no unapproved E4/E5/E6 action;
- Michael signoff when required;
- no unsafe public output;
- no policy bypass;
- no raw sensitive disclosure in client-facing contexts.

### Reviewability probes

Goal: ensure a human can audit the decision.

Signals:

- short explanation;
- evidence refs;
- decision rationale;
- uncertainty notation;
- recommended next review step.

## Tomography vector

A Wargames HPST record should emit a tomography vector.

Conceptual shape:

```yaml
kind: HPSTVector
agentRef: string
windowRef: string
axes:
  calibration: number
  consistency: number
  grounding: number
  counterfactual: number
  toolDiscipline: number
  abstention: number
  drift: number
  provenanceFidelity: number
  safetyBoundaryFidelity: number
  reviewability: number
overconfidenceIndex: number
confidence: number
status: pass | warn | fail | needs_review
proofRefs: []
```

The vector is a grading feature, not a standalone truth claim.

## Gradecard

A gradecard rolls encounters into a reviewable summary.

```yaml
kind: AgentGradecard
agentRef: string
period:
  start: string
  end: string
scores:
  calibrationECE: number
  consistencyScore: number
  groundingScore: number
  counterfactualScore: number
  toolDisciplineScore: number
  abstentionScore: number
  provenanceScore: number
  safetyScore: number
overconfidenceIndex: number
driftFlags: []
recommendations: []
promotionRecommendation: promote | hold | demote | review
proofRefs: []
reviewerRefs: []
```

## Promotion relation

HPST does not promote agents by itself. It supplies evidence to Memphis Rite governance.

Promotion requires:

- gradecard;
- proof refs;
- evidence refs;
- safety-boundary status;
- Warden review where authority changes;
- Scribe record;
- FROST/quorum where required;
- Michael Heller signoff where authority, BridgeMode, client release, E4/E5/E6, or policy exception is involved.

## Verifier economy objective

The verifier economy rewards the work of checking, reviewing, witnessing, and improving Wargames outputs.

It supports:

- build verification;
- claim witnessing;
- evidence review;
- proof-pack review;
- redaction review;
- ontology validation review;
- OFIF assurance review;
- learning-corpus review;
- agent-grade review;
- dynamic-engagement approval review.

## Microtask model

Verifier work should be represented as microtasks.

```yaml
kind: VerifierMicrotask
taskId: string
taskType: verify_build | witness_claim | review_redaction | validate_ontology | check_proof_pack | review_gradecard | approve_engagement | audit_bridge_packet
inputRefs: []
requirements:
  humansOnly: boolean
  witnessSlots: number
  independenceRequired: boolean
  domainExpertise: []
payout:
  credits: number
  reputation: number
expiry: string
safety:
  noUnsafeAction: true
  readOnly: true
  evidenceOnly: true
```

No verifier task should require unsafe action.

## Reward receipt

```yaml
kind: VerifierRewardReceipt
taskId: string
verifierRef: string
completedAt: string
result: accepted | rejected | needs_revision
creditsAwarded: number
reputationAwarded: number
meteredCost: {}
proofRefs: []
reviewRefs: []
```

## Claim witnessing

Claim witnessing follows the Memphis/FROST path.

Inputs:

- claim text;
- evidence refs;
- proof refs;
- redaction state;
- ontology validation state where semantic claim;
- disclosure boundary where public/client-facing.

Outputs:

- witness partials;
- aggregate status;
- acceptance/denial;
- dissent notes;
- promotion or hold recommendation.

## Evidence quality checks

Verifier tasks should check:

- source refs exist;
- hashes exist;
- redaction state exists;
- timestamps are coherent;
- topic refs are valid;
- safety boundary exists;
- proof refs are dereferenceable;
- claims do not exceed evidence;
- output disclosure class matches content.

## DEFENSE mode use

In DEFENSE mode, HPST and verifier economy support:

- agent gradecards;
- detector evaluation;
- incident proof review;
- dynamic engagement authorization review;
- containment/recovery after-action review;
- OFIF assurance packet review.

DEFENSE mode may correlate authorized evidence; HPST checks that such correlation remains scoped, documented, and reviewable.

## LEARNING mode use

In LEARNING mode, HPST and verifier economy support:

- corpus quality;
- topic coherence;
- annotation review;
- LSA/LSI anchor validation;
- grammar fixture review;
- redaction checks;
- reproducibility checks;
- pedagogy quality.

LEARNING outputs must preserve redaction and disclosure boundaries.

## Relation to Ontogenesis

Ontogenesis validation can create verifier tasks:

- SHACL violation review;
- ontology module promotion review;
- ATT&CK coverage claim review;
- semantic gap review;
- JSON-LD export review.

HPST can grade semantic reasoning agents using Ontogenesis validation outputs.

## Relation to SynapseIQ

SynapseIQ can consume HPST gradecards and verifier receipts as enrichment-quality signals.

Examples:

- confidence adjustment;
- activation readiness;
- quality validation;
- review-required flag;
- OFIF readiness score.

## Relation to OFIF / Orion

OFIF should expose HPST/verifier outputs only as client-appropriate summaries.

Examples:

- assurance quality score;
- proof-review status;
- remediation confidence;
- verifier-backed recommendation;
- audit digest.

Raw reviewer notes and sensitive evidence should remain internal unless explicitly approved and redacted.

## Relation to MeshRush and HellGraph

MeshRush may traverse agent-grade and verification graph views.

HellGraph should preserve:

- gradecard records;
- verifier task records;
- reward receipts;
- claim-witnessing records;
- replay/checkpoint state for promotion decisions.

## Failure modes

- probe leakage;
- evaluator overfitting;
- false humility;
- over-abstention;
- reviewer fatigue;
- verifier collusion;
- stale evidence;
- reward gaming;
- grading without ground truth;
- excessive automation of human-required review.

## Controls

- rotate probes;
- use canaries;
- require independence for witness tasks;
- require human-only tasks where policy says so;
- batch repetitive tasks;
- attach delta summaries to reduce reviewer fatigue;
- record dissent;
- expire stale reviews;
- separate scoring from promotion authority.

## Required follow-ups

Schemas:

- `hpst-vector.schema.json`;
- `hpst-probe-set.schema.json`;
- `agent-gradecard.schema.json`;
- `verifier-microtask.schema.json`;
- `verifier-reward-receipt.schema.json`;
- `claim-witness-review.schema.json`.

Examples:

- HPST vector;
- probe set;
- agent gradecard;
- verifier microtask;
- reward receipt;
- claim witness review;
- OFIF assurance quality summary.

CI checks:

- gradecards require evidence refs;
- verifier tasks must be safe/read-only/evidence-only;
- human-only tasks must not be auto-approved;
- reward receipts require proof refs;
- promotion recommendations cannot promote by themselves;
- E4/E5/E6 authorization tasks require Michael signoff until delegated policy exists.

## Completion definition

HPST and verifier economy are implementation-backed only when schemas, examples, CI validation, proof-shape validation, and promotion-gate integration exist.

Until then, this document is canonical prose capture, not runtime implementation.
