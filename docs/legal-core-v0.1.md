# Legal Core v0.1

Legal Core is the policy kernel for governed evidence work across SCOPE-D, AgentPlane, Prophet Platform, SynapseIQ, Sherlock, Holmes, MeshRush, CairnPath, GAIA, Ontogenesis, and Sociosphere.

The rule is simple: no source, endpoint artifact, semantic object, graph edge, enrichment package, runtime action, sandbox result, or report can be admitted or emitted without authority, source rights, sensitivity, purpose, jurisdiction, retention posture, safe-processing constraints, claim boundary, and non-claims.

## Seed case

The seed case is the Finder / QuickLook / WebKit preview-surface investigation.

Observed mechanism:

`Finder -> QuickLookUIService -> ANE-assisted preview activity -> Web/Web2 qldisplay -> WebKitLegacy guard fault`

Candidate objects:

- `Framework_Score.ppsx`
- `Systema-Pneumachinalis-Reformulation.pdf`

Correct state:

`unresolved_suspicious`

The case does not confirm compromise and does not clear compromise. It demonstrates the need for claim-bounded defensive evidence collection and static-first document triage.

## Core gates

| Gate | Purpose |
| --- | --- |
| `AuthorityToCollectGate` | Requires known authority before collection, ingestion, action admission, or report emission. |
| `SourceRightsGate` | Captures license, commercial use, redistribution, derivative use, model-training, attribution, retention, and deletion constraints. |
| `PrivacySensitivityGate` | Classifies public, commercial, confidential, customer confidential, regulated, security telemetry, personal, sensitive, identity-adjacent, and location/mobility material. |
| `PurposeLimitationGate` | Prevents evidence admitted for one purpose from silently promoting to another purpose. |
| `JurisdictionOverlayGate` | Records legal overlays such as U.S., state, EU/EEA, UK, Canada, sector-specific, customer-contract, export/sanctions, and data-localization constraints. |
| `SafeProcessingGate` | Blocks unsafe rendering, unapproved external lookups, mutation, network behavior, and credential access unless separately authorized. |
| `ClaimBoundaryGate` | Restricts claims to observed, inferred, hypothesis, forecast, excluded, or unresolved states. |
| `ReceiptGate` | Requires LegalReceipt / LineageReceipt / RuntimeReceipt references before promotion or release. |

## Required behavior

- `authorityBasis: unknown` blocks collection, runtime action, semantic promotion, graph binding, and report emission.
- `authorityBasis: prohibited` must block the same effects.
- Unsafe rendering is not permitted by default.
- External lookup from suspect provenance metadata is not permitted by default.
- Semantic promotion into SynapseIQ requires a Legal Core decision and claim-boundary receipt.
- Runtime action admission in AgentPlane requires a Legal Core decision and runtime receipt.
- Claim emission through Holmes requires substantiation and non-claims.

## Non-goals

- Legal Core does not provide jurisdiction-specific legal advice.
- Legal Core does not certify production readiness.
- Legal Core does not confirm compromise or clear compromise.
- Legal Core does not make source availability equivalent to permitted use.
