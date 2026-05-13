# Wargames Dynamic Engagement Policy

Status: v0.1 policy baseline  
Owner plane: SCOPE-D / Devine Intelligence Wargames defensive response governance

## Purpose

This document defines dynamic defensive engagement for Wargames. The system must be able to respond to hostile activity, but all response is boundary-aware, evidence-gated, policy-governed, auditable, and approval-bound.

Core rule:

> Inside an authorized defensive boundary, defensive response may proceed when evidence and policy gates permit it. Outside that boundary, response may proceed only through lawful, authorized, evidence-backed coordination channels.

This is not unrestricted retaliation.

## Temporary approval authority

Until a new delegated policy is created and approved, overall approval signoff belongs only to **Michael Heller**.

Michael-only signoff is required for:

- controlled engagement inside the boundary beyond ordinary containment;
- outside-boundary coordination that is not already covered by standing policy;
- adversary-emulation, red-team, purple-team, or synthetic offensive-simulation exercises;
- BridgeMode enablement;
- sensitive client-facing release;
- policy exceptions;
- any action expanding scope, authority, disclosure, or blast radius beyond standing approvals.

No agent, automation, committee, inferred rule, or substitute approver can override this rule until a replacement governance policy is explicitly approved.

## Engagement ladder

### E0 — Observe

Read-only collection and correlation inside authorized scope.

### E1 — Alert and preserve

Notify, preserve evidence, create a proof record, and route to the right owner.

### E2 — Contain owned assets

Reduce risk inside the authorized boundary using owned controls, such as isolation, blocking, quarantine, session control, pipeline pause, or namespace freeze where policy permits.

### E3 — Adapt defenses

Change defensive posture inside the boundary, such as detection updates, policy tightening, sampling changes, or redaction changes. Requires rollback posture.

### E4 — Controlled engagement inside boundary

Use approved decoys, canaries, honeypots, or synthetic surfaces inside authorized environments. Requires Michael Heller signoff unless a later delegated policy explicitly authorizes it.

### E5 — Outside-boundary coordination

Coordinate with external parties through lawful channels: provider reports, customer notification, partner coordination, legal escalation, trusted intelligence sharing, or takedown requests. Requires Michael Heller signoff unless a later delegated policy explicitly authorizes it.

### E6 — Authorized adversary-emulation exercise

Red-team, purple-team, tabletop, or synthetic exercise activity. Requires explicit authorization and Michael Heller signoff.

No authorization means no execution.

## Evidence-gated trigger

Every engagement above E1 must be backed by an engagement trigger.

```yaml
engagementTrigger:
  triggerId: string
  triggerType: attack_detected | policy_violation | boundary_breach | credential_risk | persistence_risk | lateral_movement_risk | safety_drill
  boundaryScope: inside | outside | mixed
  confidence: number
  severity: info | low | medium | high | critical
  evidenceRefs: []
  boundaryEventRefs: []
  findingRefs: []
  affectedAssets: []
  tenantScope: string
  recommendedEngagementLevel: E0 | E1 | E2 | E3 | E4 | E5 | E6
  policyRefs: []
  expiresAt: string
```

Trigger rule:

> The system may not escalate engagement unless evidence, confidence, scope, and policy gates support that engagement level.

## Authorization object

```yaml
engagementAuthorization:
  authorizationId: string
  engagementLevel: E4 | E5 | E6
  requestedBy: string
  approvedBy:
    - Michael Heller
  approvalStatus: proposed | approved | denied | expired | revoked
  tenantScope: string
  allowedAssets: []
  allowedActions: []
  prohibitedActions: []
  timeWindow:
    start: string
    end: string
  evidenceRequirements: []
  rollbackPlanRef: string
  notificationPlanRef: string
  proofReceiptRef: string
  expiry: string
```

## Boundary rule clarification

“Anything inside the boundary is fair game” means: anything inside the authorized defensive boundary may be considered for defensive response, subject to policy gates, evidence, proportionality, audit, and approval rules.

“Anything outside the boundary is fair game under policy-gated evidence trigger” means: outside-boundary response may proceed only through lawful, authorized, evidence-backed channels. The system may defend its own boundary and coordinate externally, but it may not perform unauthorized action against third-party systems.

## OFIF / Orion exposure

OFIF may expose dynamic engagement state to clients only through governed, redacted field-intelligence objects.

```yaml
dynamicEngagementSummary:
  engagementLevel: E0 | E1 | E2 | E3 | E4 | E5 | E6
  triggerRef: string
  authorizationRef: string
  scope: string
  confidence: number
  severity: string
  actionSummary: string
  proofRefs: []
  redactionState: redacted | synthetic | withheld
  clientVisible: true
```

## Required follow-ups

Schemas:

- `engagement-trigger.schema.json`
- `engagement-authorization.schema.json`
- `engagement-action.schema.json`
- `dynamic-engagement-summary.schema.json`

CI checks:

- E4/E5/E6 examples require Michael Heller approval unless a later delegated policy exists.
- Outside-boundary examples must not represent unauthorized action.
- Every engagement action requires evidence refs.
- Every mutating action requires rollback or justification.
- Every client-facing summary requires redaction state.

## Completion definition

This policy is complete when SCOPE-D can validate engagement triggers, authorizations, actions, proof receipts, and OFIF summaries through schemas and CI, and when no E4/E5/E6 action can be represented without an explicit lawful authorization path.
