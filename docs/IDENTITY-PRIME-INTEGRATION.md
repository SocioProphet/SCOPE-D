# Identity-Prime Integration

SCOPE-D uses identity evidence for defense, not surveillance. This document defines how the Identity-is-Prime doctrine is translated into machine-checkable SCOPE-D contracts.

## Core rule

Identity-is-Prime protects legitimate humans, tenants, agents, devices, and owned resources from unnecessary exposure, correlation, and mutation.

Defensive correlation may be stronger inside an explicitly authorized boundary, but benign third-party identity must still be minimized, redacted, tenant-scoped, and legally bounded.

## Prime lanes

SCOPE-D initially recognizes the following identity prime lanes:

| Prime lane | Purpose | Initial contract |
|---|---|---|
| `crypto` | Key, handle, nonce, signing, custody, and non-escape evidence | `Event-IR`, `Identity-IR`, future HSM congruence analyzer |
| `dp` | Differential privacy budget and raw identity non-escape | `Event-IR`, `Identity-IR`, `ProofArtifact` |
| `ui` | UI context, focus, overlay, consent surface, deception detection | future browser/UI Event-IR adapters |
| `behavior` | Session-scoped behavioral archetype; never a permanent human mark | future semantic-space adapter |
| `egress` | Network-shape and destination class for defensive telemetry | future network Event-IR adapter |
| `auth` | Authentication assertion and session binding | future auth Event-IR adapter |
| `device` | Attested device posture, not coercive fingerprinting | future attestation adapter |
| `policy` | Policy and capability boundary evidence | `EngagementPolicy`, `SafetyBoundary` |

## Identity-IR

`Identity-IR` is the bridge from concrete events to identity prime lanes. It records:

- the subject or synthetic subject;
- referenced Event-IR events;
- prime lanes touched by those events;
- wells where those primes are allowed to live;
- DP budget state when relevant;
- proof references;
- provenance.

Schema:

- `config/schemas/identity-ir.schema.json`

Example:

- `examples/scope-d/identity-ir.example.json`

## Event-IR

`Event-IR` records typed operational events without forcing every collector to invent its own shape. It supports synthetic observations, authentication assertions, crypto operations, DP events, raw export attempts, UI events, network flows, policy decisions, and control actions.

Schema:

- `config/schemas/event-ir.schema.json`

Example:

- `examples/scope-d/event-ir.example.json`

## Proof artifacts

`ProofArtifact` is the first place where the mathematical layer becomes operational. It can express:

- non-escape claims;
- DP budget bounds;
- scope bounds;
- dynamic distance from secure or known-bad states;
- configuration-volume estimates;
- archetype-family membership.

Schema:

- `config/schemas/proof-artifact.schema.json`

Example:

- `examples/scope-d/proof-artifact.example.json`

## Defensive correlation rule

Inside an authorized defended boundary, SCOPE-D may correlate adversary-controlled infrastructure, behaviors, and artifacts to protect the system.

This does not override identity minimization for benign third parties. If evidence contains legitimate human identity, SCOPE-D must prefer redaction, aggregation, synthetic representation, or scoped proof references.

## What is not implemented yet

This document does not claim that the following runtime components exist:

- HSM congruence non-escape analyzer;
- DP budget analyzer;
- abstract-interpretation domains for interval, congruence, grid, sharing, or NNC polyhedra;
- UI deception detector;
- egress-shape detector;
- behavioral archetype learner;
- Identity Guardian agent.

Those components must be implemented as separate analyzers and must emit `ProofArtifact` objects before their outputs are treated as control evidence.

## Integration target

The first vertical slice should be:

`Synthetic Event -> Event-IR -> Identity-IR -> ProofArtifact -> ControlLoopRun -> RunReceipt -> RunSummary -> Ontogenesis export`

This slice is narrow enough to test today and broad enough to prove the architecture is not just prose.
