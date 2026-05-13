# Wargames Integration: OFIF / Orion Field Intelligence

Status: v0.1 reconciliation baseline  
Owner plane: SCOPE-D / Devine Intelligence Wargames client-facing capability integration  
Related repo: `SocioProphet/orion-field-intelligence`

## Purpose

This document adds Orion Field Intelligence Framework (OFIF) as a first-class Wargames capability surface.

OFIF is the client-facing field-intelligence layer. Clients should access Wargames-derived posture, evidence, reasoning, assurance, and tasking through OFIF rather than raw SCOPE-D internals.

SCOPE-D Wargames remains the defensive validation and evidence-production layer. OFIF exposes governed, client-appropriate field intelligence.

## Grounded repo position

`SocioProphet/orion-field-intelligence` defines OFIF as event-driven sensor fusion plus reasoning for field operations.

That makes OFIF the correct client-facing access plane for field intelligence derived from SCOPE-D Wargames evidence.

## Stack position

```text
SCOPE-D Wargames
  defensive validation, exercises, findings, proofs, safety gates
        |
        v
Boundary Cyber Hypergraph
  Component, Port, Contract, BoundaryEvent, Evidence, Finding, Artifact
        |
        v
Ontogenesis
  RDF/OWL/JSON-LD, SHACL, ATT&CK understanding, semantic governance
        |
        v
OFIF / Orion Field Intelligence
  client-facing sensor fusion, reasoning, field intelligence, access surface
```

OFIF does not replace SCOPE-D, Ontogenesis, MeshRush, HellGraph, or Regis. It is the governed delivery surface for client-facing field intelligence.

## Client-facing capability classes

Allowed capability classes:

- posture summaries;
- field observations;
- fused evidence summaries;
- prioritized findings;
- confidence-scored recommendations;
- defensive gap summaries;
- ATT&CK coverage summaries;
- proof-backed assurance packets;
- remediation plans;
- drill results;
- trend and drift summaries;
- executive field briefings;
- machine-readable client reports.

Not exposed by default:

- raw sensitive logs;
- raw identity joins;
- raw proof internals where unnecessary;
- unredacted tenant data;
- internal detector internals;
- internal graph traversal state;
- unpublished ontology internals;
- unsafe tactical procedure details.

## Authorized exercise approval

Any adversary-emulation, red-team, purple-team, or synthetic offensive-simulation exercise exposed through OFIF must carry an authorization reference.

Until a delegated policy is approved, overall signoff for such exercises belongs only to Michael Heller.

Minimum authorization fields:

```yaml
exerciseAuthorization:
  authorizationId: string
  exerciseType: red_team | purple_team | adversary_emulation | synthetic_only | tabletop
  requestedBy: string
  approvedBy:
    - Michael Heller
  approvalStatus: proposed | approved | denied | expired | revoked
  scope:
    tenant: string
    assets: []
    environments: []
    timeWindow:
      start: string
      end: string
  safetyClass: synthetic_only | read_only | controlled_live | blocked
  allowedActions: []
  prohibitedActions: []
  evidenceRequirements: []
  rollbackPlanRef: string
  notificationPlanRef: string
  proofReceiptRef: string
  expiry: string
```

No authorization means no execution and no client-visible tasking.

## Capability lanes

### Field Observation

Client-facing view of what was observed.

Outputs:

- `FieldObservation`
- `ObservationSummary`
- `ConfidenceScore`
- `EvidenceDigest`

### Sensor Fusion

Multi-source fusion over validated evidence.

Outputs:

- `FusedSignal`
- `FusedFinding`
- `FieldConfidence`
- `ContradictionReport`

### Defensive Reasoning

Client-facing explanation of what the evidence means.

Outputs:

- `ReasonedFinding`
- `WhyThisMatters`
- `RecommendedAction`
- `ResidualRisk`

### Assurance Packet

Client-consumable proof-backed reporting.

Outputs:

- `AssurancePacket`
- `AuditDigest`
- `CustomerReport`
- `ExecutiveBrief`

### Field Tasking

Governed client-facing tasking and follow-up.

Outputs:

- `FieldTask`
- `RemediationPlan`
- `VerificationRequest`
- `CompletionEvidence`

## Client access model

Clients access OFIF capabilities, not raw SCOPE-D internals.

| Tier | Description | Allowed outputs |
|---|---|---|
| `executive` | business-level assurance and risk posture | summaries, KPIs, assurance packets |
| `operator` | client security/operator workflow | findings, recommendations, tasking, evidence digests |
| `auditor` | audit and compliance verification | signed reports, proof digests, validation status |
| `integrator` | machine-to-machine integration | JSON/JSON-LD reports, task status, coverage summaries |
| `internal` | SocioProphet internal defense work | broader evidence views under policy gate |

Every OFIF output should declare:

- client scope;
- tenant scope;
- redaction state;
- confidence;
- proof refs;
- source run refs;
- ontology validation refs;
- disclosure class;
- retention policy;
- authorization ref when exercise-derived.

## Suggested objects

### FieldObservation

```yaml
kind: FieldObservation
id: ofif-observation:<id>
sourceRunRef: scope-d-run:<id>
boundaryEventRefs: []
surfaceRefs: []
topicRefs: []
summary: string
confidence: number
redactionState: raw | redacted | synthetic | withheld
proofRefs: []
authorizationRef: string
```

### FusedFinding

```yaml
kind: FusedFinding
id: ofif-finding:<id>
findingRefs: []
evidenceDigestRefs: []
attackCoverageRefs: []
controlRefs: []
severity: info | low | medium | high | critical
confidence: number
clientImpact: string
recommendedActions: []
proofRefs: []
authorizationRef: string
```

### AssurancePacket

```yaml
kind: AssurancePacket
id: ofif-assurance:<id>
clientScope: string
period:
  start: string
  end: string
postureSummaryRef: string
coverageSummaryRefs: []
proofDigestRefs: []
validationRefs: []
disclosureClass: internal | client | auditor | public_redacted
signatures: []
```

### FieldTask

```yaml
kind: FieldTask
id: ofif-task:<id>
clientScope: string
findingRef: string
owner: string
recommendedAction: string
status: proposed | accepted | in_progress | verified | deferred
verificationEvidenceRefs: []
proofRefs: []
authorizationRef: string
```

## Required follow-ups

Schemas:

- `ofif-field-observation.schema.json`
- `ofif-fused-finding.schema.json`
- `ofif-assurance-packet.schema.json`
- `ofif-field-task.schema.json`
- `ofif-client-access-envelope.schema.json`
- `authorized-exercise-flow.schema.json`

Examples:

- executive posture summary;
- operator fused finding;
- auditor assurance packet;
- integrator JSON-LD report;
- approved adversary-emulation exercise envelope;
- denied or expired exercise authorization envelope.

## Completion definition

This integration is complete when SCOPE-D Wargames can emit OFIF-ready field-intelligence envelopes, Ontogenesis validates semantic meaning before OFIF publication, and OFIF objects include scope, confidence, redaction, proof refs, disclosure class, and authorization refs where applicable.
