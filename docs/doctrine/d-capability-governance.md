# D-Capability Governance Doctrine

Status: v0.1 doctrine anchor  
Scope: SCOPE-D sensitive capability governance  
Runtime effect: none  

## Purpose

SCOPE-D treats dangerous or sensitive defensive capabilities as explicit governed classes. The repository must not implement sensitive behavior merely because a script can perform it. Sensitive capability must first be named, scoped, policy-gated, receipt-backed, tested with negative fixtures, and bound to operator evidence.

This doctrine defines the D-plane for SCOPE-D.

## D capability classes

The D-plane recognizes six sensitive capability classes:

1. `live_target_action`
2. `network_access`
3. `credential_access`
4. `payload_delivery`
5. `mutation`
6. `destructive_behavior`

These classes are not equivalent. Recognition of a class is not authorization to perform it.

## Non-claims

SCOPE-D does not claim that a capability is safe because it is named in a schema.

SCOPE-D does not claim that planning, dry-run, local/passive execution, or synthetic execution authorizes live behavior.

SCOPE-D does not authorize credential guessing, credential replay, credential stuffing, password spraying, token extraction, exploit payload delivery, persistence, data exfiltration, denial-of-service, destructive testing, or direct production mutation by default.

SCOPE-D does not allow sensitive capabilities to bypass policy gates, operator decisions, evidence receipts, or client-safe reporting boundaries.

## Promotion ladder

Sensitive capability must progress through the following maturity ladder:

| Level | Name | Meaning | Runtime permission |
| --- | --- | --- | --- |
| D0 | Recognition | Capability vocabulary and non-claims exist. | None |
| D1 | Policy gate | Policy, request, and decision schemas exist. | None |
| D2 | Plan / dry-run | Non-executing plan and dry-run receipts exist. | None |
| D3 | Synthetic / local evidence | Synthetic or local/passive evidence may be transformed into results. | Local only |
| D4 | Gated live-read-only | Explicitly authorized live read-only observation may occur. | Read-only only |
| D5 | Proposal-only mutation | Proposed changes, diffs, and rollback plans may be generated. | No write |
| D6 | PR-only mutation | A proposed change may be opened as a reviewable pull request. | Reviewable write to branch only |
| D7 | Staging mutation | Approved change may apply to staging or lab surfaces. | Staging only |
| D8 | Approved live mutation | Narrow, approved, reversible live change may occur. | Live, gated, reversible |

No capability may skip levels.

## Required artifact pattern

Every D-capability tranche must include, at minimum:

- capability vocabulary or schema entry;
- positive fixture;
- negative fixture;
- semantic validator or explicit test coverage;
- policy gate or explanation of why the tranche is pre-policy;
- decision receipt if authorization is involved;
- dry-run or synthetic-only path before any live behavior;
- receipt format for any observation or action;
- operator ledger or case binding when work is produced;
- explicit non-claims;
- client-report boundary if evidence can flow to client artifacts.

Mutation-related tranches additionally require:

- rollback plan;
- pre-change evidence requirement;
- post-change reassessment requirement;
- separation between proposal, branch write, staging write, and live write;
- no auto-merge and no direct production mutation unless a later doctrine update permits it.

## Capability-specific boundaries

### live_target_action

Allowed only after capability decision, target scope, and method scope are established.

Current allowed maturity: D4 for live-read-only scan observations behind explicit gates.

### network_access

Network access must be method-scoped, target-scoped, rate-limited, time-bounded, and receipt-backed.

Read-only DNS, TLS metadata, and HTTP HEAD observations may be modeled under D4. Broader scanning requires additional policy.

### credential_access

Credential access is not authorized as credential use or credential attack.

Allowed near-term form: credential posture assessment from user-supplied metadata, secret-scanning outputs, token-scope metadata, or redacted findings.

Prohibited by default: guessing, stuffing, spraying, replay, extraction, login attempts, secret harvesting, and token use against systems.

### payload_delivery

Payload delivery is not authorized as exploit delivery.

Allowed near-term form: synthetic payload-result ingestion, canary plan descriptions, non-executing payload plans, and client-safe reporting of provided evidence.

Prohibited by default: exploit payloads, malware-like payloads, persistence payloads, shells, exfiltration payloads, and active vulnerability exploitation.

### mutation

Mutation must begin as proposal-only remediation.

Allowed near-term form: remediation plans, proposed diffs, branch-only pull requests, rollback plans, and post-change reassessment instructions.

Prohibited by default: direct production writes, cluster mutation, deployment, secret rotation execution, firewall changes, destructive delete/disable operations, and auto-merge.

### destructive_behavior

Destructive behavior must remain modeled but non-executable unless a separate lab-only doctrine is adopted.

Allowed near-term form: blast-radius modeling, tabletop scenarios, rollback readiness assessment, synthetic failure fixture ingestion.

Prohibited by default: deletion, service disruption, denial-of-service, resource exhaustion, data destruction, kill switches, and destructive live testing.

## Review requirement

Any PR that introduces or expands a D-capability class must identify:

- affected class;
- current maturity level;
- target maturity level;
- policy gate status;
- receipts added;
- negative fixtures added;
- non-claims added;
- whether live behavior is introduced;
- whether mutation is introduced;
- whether rollback is required.

## Current repository state

As of this doctrine anchor:

- `live_target_action`: modeled and partially implemented only for gated live-read-only observation.
- `network_access`: modeled and partially implemented only for gated live-read-only observation.
- `credential_access`: recognized and blocked.
- `payload_delivery`: recognized and blocked.
- `mutation`: recognized and blocked; proposal-only mutation not yet implemented.
- `destructive_behavior`: recognized and blocked.

## Doctrine rule

D-capabilities may be made useful, but never invisible.

A sensitive capability that lacks policy, receipt, and negative-fixture coverage is not allowed to advance beyond recognition or planning.
