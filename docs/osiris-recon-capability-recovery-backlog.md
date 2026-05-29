# OSIRIS Recon Capability Recovery Backlog

Status: captured backlog, not live enablement
Source quarantine repo: `mdheller/osiris`
Related boundary: `docs/osiris-scanner-sweep-quarantine.md`

## 1. Purpose

This document captures the OSIRIS-discovered recon, scanner, sweep, vulnerability, and passive lookup capabilities so they are not lost merely because they are unsafe to enable directly.

The policy remains:

```text
capture everything -> classify action risk -> define EngagementPolicy -> fixture first -> validate denial paths -> enable only by authorization
```

This is not an implementation authorization. This is a recovery backlog.

## 2. Controlling boundary

SCOPE-D owns any capability that can touch a user-supplied target, enumerate a host/subnet, probe services, fingerprint software, enrich vulnerabilities, or produce operator-facing cyber action recommendations.

Orion may display passive cyber exposure objects. Gaia may preserve passive source records. Neither Gaia nor Orion may execute scanner/sweep/recon workflows.

## 3. Required control primitives

Every recovered capability must declare:

- `EngagementPolicy`
- `TargetScope`
- `AuthorizationRef`
- `ExecutionMode`
- `NonDestructiveOnly`
- `NetworkBoundary`
- `SourceEvidenceRef`
- `OperatorIdentityRef`
- `ReceiptRequired`
- `ActionDeniedReceipt`
- `ActionAuthorizedReceipt`

## 4. Recovery inventory

| Capability | OSIRIS surface | Risk class | Recovery path | Required gate |
|---|---|---|---|---|
| Scanner proxy | `/api/scanner` | critical | Rebuild as SCOPE-D policy-gated scanner adapter, fixture-first. | EngagementPolicy + TargetScope + AuthorizationRef. |
| Quick scan | scanner type `quick` | critical | Define non-destructive fixture semantics before any live action. | NonDestructiveOnly + receipt. |
| SSL inspection | scanner type `ssl` | high | Passive/declared-scope TLS metadata collection only. | TargetScope + authorization. |
| Headers inspection | scanner type `headers` | high | Passive/declared-scope HTTP metadata collection only. | TargetScope + authorization. |
| Reverse DNS | scanner type `rdns` | medium/high | Passive lookup candidate, but target-scoped. | Scope + receipt. |
| Subdomains | scanner type `subdomains` | high | Passive-source enumeration only unless authorized. | Scope + source terms + receipt. |
| Tech detection | scanner type `tech` | high | Passive banner/metadata detection only under authorization. | Scope + non-destructive mode. |
| WHOIS lookup | `/api/osint/whois` | medium/high | Passive lookup with stale-data and privacy caveats. | Source terms + receipt. |
| Geolocation lookup | scanner/geoloc + `ip-api` | medium/high | Passive source lookup with provider terms and privacy caveats. | Source terms + scope. |
| Vulnerability enrichment | scanner type `vuln`, Shodan/NVD style data | high/critical | Passive evidence-only enrichment, no exploitation path. | Scope + source terms + no-action receipt. |
| CIDR sweep | `/api/osint/sweep` | critical | Do not enable live sweep until full engagement policy exists. | EngagementPolicy + bounded CIDR + authorization. |
| Shodan InternetDB enrichment | `/api/osint/sweep` | high/critical | Passive fixture-first source enrichment. | Source terms + scope + receipt. |
| DNS lookup | `/api/osint/dns` | medium | Passive lookup candidate. | Source terms + receipt. |
| Certificate lookup | `/api/osint/certs` | medium | Public CT/cert metadata candidate. | Source version + receipt. |
| BGP lookup | `/api/osint/bgp` | medium | Public routing context candidate. | Source terms + confidence caveat. |
| MAC vendor lookup | `/api/osint/mac` | low/medium | Passive manufacturer metadata candidate. | Source terms + privacy caveat. |
| Phone intelligence | `/api/osint/phone` | high | Hold until privacy/legal policy exists. | Lawful basis + privacy review. |
| Leak/breach references | `/api/osint/leaks` | high | Hold until breach-data handling policy exists. | Legal/privacy review. |
| GitHub public context | `/api/osint/github` | medium | Public repo/profile context only; no secrets harvesting. | API terms + no-credential boundary. |
| Crypto wallet lookup | `/api/osint/crypto` | medium/high | Public ledger context only; no identity proof. | Source terms + no-attribution caveat. |
| Sanctions matching | OSINT panel/OpenSanctions/OFAC style | medium/high | Dataset-versioned matching with false-positive caveats. | Attribution + match confidence + review. |

## 5. Explicitly blocked implementation patterns

These OSIRIS patterns must not be copied:

- `stealthFetch` or spoof/evasion behavior.
- Ungated scanner proxy runtime.
- Ungated IP/CIDR sweep runtime.
- UI that makes unauthorized scan/sweep actions look available.
- Any workflow that treats passive enrichment as authorization to act.
- Any workflow that stores credentials in fixtures/examples.

## 6. Negative fixtures required before live work

Future SCOPE-D validation should reject:

1. scanner request with no `EngagementPolicy`,
2. scanner request with no `TargetScope`,
3. scanner request with no `AuthorizationRef`,
4. scanner request with `scan=true` in fixture/public-demo mode,
5. sweep request with unbounded CIDR,
6. sweep request with no receipt sink,
7. vulnerability workflow that suggests exploitation or mutation,
8. private/internal target unless explicitly authorized by internal engagement profile,
9. any use of stealth/evasion fetch semantics.

## 7. Positive fixture required before live work

The first positive fixture may permit only:

- fixture target,
- declared target scope,
- explicit authorization ref,
- non-destructive passive enrichment,
- no live external target contact,
- receipt emission,
- clear operator readout that no action is authorized.

## 8. Recovery order

1. Policy and schema definitions: EngagementPolicy, TargetScope, AuthorizationRef, ExecutionMode, Receipt.
2. Negative fixtures and validator.
3. Passive lookup fixtures: DNS, WHOIS, certs, BGP, MAC.
4. Passive CVE/NVD enrichment fixtures.
5. Shodan/InternetDB style enrichment only after terms review.
6. Scanner proxy redesign as SCOPE-D-owned adapter.
7. CIDR sweep remains last and requires explicit engagement authorization.

## 9. Completion definition

This backlog is complete when each OSIRIS recon/OSINT capability has one of:

- passive lookup path,
- SCOPE-D policy-gated action path,
- legal/privacy review hold,
- explicit blocked implementation replacement.

No capability should disappear merely because the inherited implementation is unsafe.
