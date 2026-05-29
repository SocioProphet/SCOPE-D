# OSIRIS Scanner/Sweep Quarantine Boundary

Status: boundary record
Origin: `mdheller/osiris` excavation
Target owner: `SocioProphet/SCOPE-D`

## 1. Purpose

This document records the SCOPE-D ownership boundary for scanner, sweep, recon, vulnerability, and target-enrichment surfaces discovered during OSIRIS excavation.

`mdheller/osiris` remains a quarantine/excavation carcass. It is not the product home and must not become the execution authority for scanner or sweep workflows.

Orion may display passive cyber exposure as a governed field-intelligence object. Orion must not authorize live scanning, sweeping, exploitation, mutation, or unbounded network action.

## 2. Excavation references

Read-only inspection in `mdheller/osiris` identified the relevant metadata documents and inherited paths:

- `docs/extraction-handoff-to-orion-gaia.md`
- `docs/osiris-route-risk-map.md`
- `docs/osiris-component-map.md`
- `src/components/OsintPanel.tsx`
- `src/app/api/scanner/route.ts`
- `src/app/api/osint/sweep/route.ts`
- `src/lib/ssrf-guard.ts`
- `src/lib/stealthFetch.ts`

These are references only. They are not approved implementation sources.

## 3. Controlling decision

Scanner, sweep, recon, vulnerability scan, device classification, target geolocation, and related active network behaviors are SCOPE-D-governed capabilities only.

They require policy, scope, authorization, non-destructive execution constraints, network boundary controls, and receipts before any runtime path may exist.

Default posture:

```text
policy_required
scope_required
authorization_required
receipt_required
non_destructive_only
```

## 4. Explicit quarantine

The following inherited concepts must remain quarantined unless reimplemented under SCOPE-D controls:

| Surface | Quarantine reason |
|---|---|
| OSINT panel scanner tab | User-entered target can trigger network action. |
| Vulnerability sweep tab | Can imply target probing/enrichment beyond passive lookup. |
| IP sweep route | Enumerates CIDR host ranges and queries external intelligence services. |
| Scanner proxy route | Proxies target requests through scanner credentials. |
| Shodan InternetDB sweep | External service enrichment across generated host ranges. |
| `stealthFetch` | Spoofing/evasion semantics are unacceptable for governed product ingestion. |
| Map scan-target visualization | Can make unauthorized target action look normalized or endorsed. |

## 5. Required SCOPE-D primitives

Any future SCOPE-D implementation must include:

- `EngagementPolicy`
- `TargetScope`
- `AuthorizationRef`
- `ExecutionMode`
- `NonDestructiveOnly`
- `NetworkBoundary`
- `SourceEvidenceRef`
- `ReceiptRequired`
- `OperatorIdentityRef`
- `ActionDeniedReceipt`
- `ActionAuthorizedReceipt`

## 6. Passive vs active distinction

Allowed as Orion/Gaia-facing passive concepts after provenance wrapping:

- CVE metadata lookup.
- Public vulnerability database reference.
- Software/vendor exposure declared by a fixture or authorized asset inventory.
- Source-ledgered cyber exposure marker.

Not allowed without SCOPE-D gates:

- Live scan.
- Port sweep.
- Host enumeration.
- Service fingerprinting.
- Banner grabbing.
- Vulnerability probing.
- Any user-supplied target network action.
- Any stealth, evasion, or source-terms bypass behavior.

## 7. Required negative fixtures

Future SCOPE-D validation should reject:

1. Scanner request with no `EngagementPolicy`.
2. Scanner request with no `TargetScope`.
3. Scanner request with no `AuthorizationRef`.
4. Scanner request with `ExecutionMode` outside non-destructive bounds.
5. Scanner request with unresolved or private/internal target unless specifically authorized by an internal engagement profile.
6. Sweep request with unbounded CIDR.
7. Sweep request with no receipt sink.
8. Any action path that uses spoofing/evasion fetch semantics.

## 8. Required positive fixture

A future positive fixture may allow only:

- Fixture-mode target.
- Declared target scope.
- Explicit authorization reference.
- Non-destructive passive enrichment.
- No live external target contact.
- Receipt emission.

This fixture should prove the policy chain, not scanner efficacy.

## 9. Orion/Gaia interface rule

Orion may consume the result of a SCOPE-D-governed cyber exposure object.

Gaia may preserve source records for passive public cyber sources.

Neither Orion nor Gaia may execute scanner/sweep actions. The execution boundary remains SCOPE-D.

## 10. Non-goals

- No scanner implementation in this document.
- No live target interaction.
- No credential wiring.
- No direct OSIRIS code reuse.
- No stealth/evasion helper.
- No Orion UI enablement for scanning.

## 11. Coordination links

Current related work:

- `SocioProphet/gaia-world-model#29` — Gaia-owned transparent source adapters for Orion map MVP.
- `SocioProphet/orion-field-intelligence#2` — Orion-owned event map shell MVP.

This file exists because GitHub Issues are currently disabled for `SocioProphet/SCOPE-D`.
