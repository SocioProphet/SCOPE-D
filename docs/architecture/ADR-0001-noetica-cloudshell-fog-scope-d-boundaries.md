# ADR-0001: Noetica, CloudShell Fog, and SCOPE-D Runtime Boundaries

Status: accepted
Date: 2026-06-28

## Context

SCOPE-D is becoming the cyber assurance, evidence, and detection layer of the SocioProphet estate. Noetica already contains offensive and defensive model families and operator-facing model workflows. CloudShell Fog is emerging as an embeddable edge operator bastion and mesh substrate.

The system needs a clear boundary so model execution, evidence governance, edge deployment, detection generation, and operator work do not collapse into one ambiguous runtime.

## Decision

SCOPE-D does not own offensive or defensive model pools.

Noetica owns the operator workbench and model-facing runtime surface. Noetica may expose offensive and defensive model families, but those capabilities are governed by PolicyFabric, operator approvals, and evidence requirements.

SCOPE-D owns cyber evidence, intelligence receipts, detection candidate generation, ATT&CK mapping, assurance reporting, graph-ready exports, and policy-gated handoff artifacts.

CloudShell Fog is an authorized edge operator bastion and mesh execution substrate. It is not documented as malware, stealth persistence, or an unauthorized implant. Its permitted role is to host approved edge/mesh workflows such as read-only observation, lab review, policy-gated delivery, and mesh-edge assurance.

Prophet Mesh coordinates specialist agents. HellGraph is the operational cyber graph runtime. Sherlock Search indexes evidence, detections, cases, and graph neighborhoods. SynapseIQ performs grounded synthesis over receipt-backed evidence. Orion Field Intelligence provides external field context and topology overlays.

## Architecture

```text
CloudShell Fog
  -> runtime / identity / mesh / policy substrate
  -> Noetica operator workbench
  -> model router / OpenClaw / local model pools
  -> Prophet Mesh specialist agents
  -> SCOPE-D evidence and detection fabric
  -> HellGraph operational graph
  -> Sherlock Search retrieval
  -> SynapseIQ grounded synthesis
  -> Orion Field Intelligence overlays
```

## Noetica responsibilities

- Operator workbench
- Model routing surface
- Offensive and defensive model-family presentation
- Local inference UX
- Human review flow
- Case workspace display
- WhiteRabbitNeo defensive review workflow presentation

## SCOPE-D responsibilities

- Intelligence receipts
- Evidence envelopes
- Detection candidates
- Rule provenance
- ATT&CK mappings
- CloudShell Fog delivery posture artifacts
- WhiteRabbitNeo defensive-review boundaries
- Noetica workspace seeds
- Sherlock/SynapseIQ/Orion/HellGraph handoffs
- Client assurance reports

## CloudShell Fog responsibilities

- Authorized edge operator bastion
- Read-only observation host
- Policy-gated delivery point
- Edge/mesh assurance runtime
- SourceOS/PolicyFabric-aligned admission surface

## Explicit prohibitions

CloudShell Fog must not be represented or implemented as:

- unauthorized access tooling;
- stealth persistence;
- payload execution substrate;
- credential collection mechanism;
- log mutation tool;
- public scanning engine.

WhiteRabbitNeo workflows must remain defensive and grounded. Allowed use includes rule explanation, false-positive review, coverage-gap review, and safe lab detection triage. Blocked use includes payload creation, evasion guidance, credential theft, unauthorized exploitation, and destructive action.

## Consequences

SCOPE-D can generate detection candidates and delivery posture, but it does not execute offensive workflows. Noetica can display and route model workflows, but SCOPE-D requires every model-assisted output to remain grounded in evidence receipts and operator approval.

This boundary lets the platform demonstrate advanced WhiteRabbitNeo workflows safely: the model can explain and review receipt-backed detections, while SCOPE-D preserves provenance and CloudShell Fog provides a governed edge/bastion deployment target.
