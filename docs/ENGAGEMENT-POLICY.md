# SCOPE-D Engagement Policy

SCOPE-D is a defensive purple-team control fabric. This document defines the initial operating boundary for any collector, analyzer, synthetic validation, countermeasure generation, or future runtime action.

## Authority

The current approving authority is:

- **Name:** Michael Heller
- **Email:** michael@socioprophet.ai
- **Handle:** @michael

No delegation is assumed. Delegation must be introduced by a future signed policy artifact and validated by a policy engine before any agent or human treats it as active.

## Default posture

The default posture is **synthetic-only** or **read-only**.

Allowed by default:

- read repository metadata;
- validate schemas and examples;
- generate synthetic events;
- initialize local synthetic runs;
- verify local run artifacts;
- produce reports and receipts;
- generate countermeasure candidates as recommendations.

Blocked by default:

- credential collection;
- public network scanning;
- payload execution;
- persistence;
- log mutation;
- destructive action;
- unauthorized external contact;
- production write without an explicit gate;
- identity modification without an explicit gate.

## Boundary classes

SCOPE-D recognizes these engagement boundary classes:

1. `synthetic_lab` — local synthetic examples, fixtures, and generated runs.
2. `owned_assets` — assets owned by SocioProphet / SourceOS / SociOS and explicitly in scope.
3. `customer_authorized` — customer assets with written authorization and scoped rules of engagement.
4. `public_research` — passive public information research only; no scanning or interaction without authorization.
5. `blocked` — anything outside explicit scope.

## Escalation rule

Any movement from `read_only`, `synthetic_only`, or `dry_run` into a live network call, write, deployment, identity mutation, or production change requires both:

1. a policy decision; and
2. approval by the current authority or a future signed delegated authority.

## Dynamic defensive response

SCOPE-D may use stronger correlation and response logic inside an authorized defended boundary, but the boundary must be explicit and auditable.

Inside the authorized boundary, SCOPE-D may correlate adversary-controlled infrastructure, behaviors, artifacts, and synthetic attack-path evidence to defend the system.

Outside the authorized boundary, SCOPE-D must default to blocked or metadata-only passive analysis.

## Identity handling

Identity evidence must be minimized, redacted, and tenant-scoped unless the engagement policy explicitly allows more. Benign third-party identities are protected even during defensive analysis.

Adversary-controlled or synthetic identities may be correlated aggressively only within the authorized boundary and only for defensive purposes.

## Machine-readable policy

The initial machine-readable example is:

- `examples/scope-d/engagement-policy.example.json`

The validating schema is:

- `config/schemas/engagement-policy.schema.json`

Future collectors and runners must check an active engagement policy before performing network calls, writes, deployments, or any action above synthetic/read-only mode.
