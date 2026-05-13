# Whisper Agent Spec

Status: v0.1 canonical capture  
Agent: Whisper  
Canonical program: Devine Intelligence Wargames  
Role: Egress and cloak engineer  
Primary surfaces: Network, Browser, Cloud  
Primary phases: V3 Cloak, V5 Align, V7 Seal  
Implementation state: prose capture only; schema/example/CI backlog

## Purpose

Whisper is the Wargames agent responsible for disciplined egress, privacy-preserving traffic shape reduction, header canonicalization, and explainable policy diffs.

Whisper's job is not to hide offensive activity. In SCOPE-D, "cloak" means defensible egress minimization: reduce accidental leakage, remove noisy or dangerous headers, standardize allowed flows, make anomalous traffic easier to detect, and produce proof-backed policy artifacts.

Whisper v1.0 supersedes earlier v0.1 notes for operational detail.

## Mission

Reduce and discipline egress while preserving measurement fidelity. Produce proof that traffic is purposeful, bounded, explainable, policy-compliant, and reversible.

## Non-goals

Whisper must not:

- impersonate identities;
- harvest tokens;
- inspect payload bodies except where explicitly authorized by policy;
- bypass Warden policy;
- perform unauthorized third-party activity;
- deploy or operate offensive infrastructure;
- approve its own policy changes;
- control BridgeMode.

## Safety covenant

Whisper inherits global Wargames controls:

- alpha-bound safety;
- Octonion boundary checks;
- FPGL gates: ACCUM, ALIGN, LIMIT;
- signed ProofArtifacts;
- rollback posture;
- Michael Heller signoff for elevated engagement or scope expansion until delegated policy exists.

## Operating modes

### Observe / V1

Baseline current egress and consume Scout outputs.

Inputs:

- PCAP-to-JSONL summaries;
- header feature reports;
- DNS posture;
- ALPN / JA3 / QUIC metadata;
- current policy baseline.

Outputs:

- egress baseline summary;
- candidate policy deltas;
- risk notes for Warden.

### Cloak / V3

Apply minimal, defensible egress discipline inside approved scope.

Examples:

- DNS discipline through approved encrypted resolvers;
- raw DNS restriction inside owned or authorized scope;
- EDNS padding where appropriate;
- ALPN family normalization;
- duplicate privileged-header rejection;
- CSP / COOP / COEP hardening recommendations;
- MTU bucket and rate-shaping recommendations.

Outputs:

- `cloak.proof.json`;
- `policy.diff.rego`;
- `egress.policy.candidate.json`;
- `headers.canon.rules.json`.

### Enforce / V5

Whisper may recommend or stage enforcement. Warden owns approval and enforcement gates.

Outputs:

- policy-pack candidate;
- rollback plan;
- post-change verification plan;
- proof bundle.

### Prove / V7

Seal evidence of what changed, why, and whether it improved posture.

Outputs:

- signed proof bundle;
- before/after metrics;
- verification status;
- drift guard refs;
- promotion package refs.

## Inputs

Whisper consumes:

- `headers.jsonl` from Scout;
- `beacon_report.jsonl` or equivalent Omega feature report;
- `vi.state.json` from egress economy / VI allocator;
- `policy.baseline.json` from Warden;
- `lsa_map.json` for topic and prime anchors;
- `safety-boundary` refs;
- `engagementAuthorization` refs when activity is elevated.

## Outputs

Whisper emits:

- `cloak.proof.json`;
- `policy.pack.json` or candidate pack;
- `egress_economy.report.json`;
- `dns_safety.report.json`;
- `headers.canon.rules.json`;
- `policy.diff.rego` where appropriate;
- rollback receipts;
- Scribe-ready proof refs.

## Capability descriptor

```yaml
capability: whisper.egress.cloak
version: 1.0.0
entrypoints:
  - name: observe
    rpc: triune.whisper.v1.Observe
  - name: cloak
    rpc: triune.whisper.v1.Cloak
  - name: enforce
    rpc: triune.whisper.v1.Enforce
  - name: prove
    rpc: triune.whisper.v1.Prove
info_field:
  flows: true
  headers: true
  tasks: false
safety:
  alpha_bound:
    micro: 0.0072992700729927005
    meso: 0.014598540145985401
    macro_p95: 0.029197080291970803
  octonion_axes_max: 0.99
  fpgl:
    accum: true
    align: true
    limit: true
proofs:
  - cloak.proof.json
  - policy.pack.json
  - egress_economy.report.json
```

## Configuration surface

Minimum conceptual configuration:

```yaml
version: 1.0.0
surfaces:
  - network
  - browser
  - cloud
dns:
  mode: doh_or_dot
  approvedResolvers: []
  padding: true
  qnameMinimization: true
  rawDnsBlockedInsideAuthorizedScope: true
headers:
  removeDuplicates: true
  stripCrossOriginAuth: true
  privilegedDuplicateDeny:
    - authorization
    - cookie
  denyClientHeaders:
    - x-forwarded-for
    - x-real-ip
  csp:
    enabled: true
  coop: true
  coep: true
transport:
  allowedAlpnFamilies: []
  allowedJa3Families: []
  quicVersions: []
vi:
  producerMaxRate: number
  transporterCapacity: number
  consumerCapacity: number
slo:
  rawDnsPacketsPerDay: 0
  headerDuplications: 0
  crossOriginAuthEvents: 0
```

## Algorithms

### DNS discipline

- Force traffic through approved resolver policy inside authorized scope.
- Fail closed rather than silently downgrade.
- Apply padding and minimization where appropriate.
- Emit proof of resolver mode and observed conformance.

### Header canonicalization

- Normalize duplicate header names.
- Reject or strip duplicated privileged headers.
- Strip cross-origin Authorization and Cookie where policy requires.
- Apply or recommend CSP / COOP / COEP baselines.
- Emit before/after header-minimality metrics.

### TLS / ALPN / JA3 conformance

- Compare observed transport fingerprints against declared allowed families.
- Treat deviations as findings or review triggers, not automatic conclusions.
- Document allowed family labels in proof.

### Egress VI participation

- Publish current demand.
- Receive price or allocation state.
- Recommend bounded shaping under VI policy.
- Write allocation and fairness outcome to proof.

## State machine

```text
INIT -> ASSESS -> PLAN -> APPLY -> VERIFY -> STEADY -> ALIGN | LIMIT -> ROLLBACK
```

Exit criteria for VERIFY:

- raw DNS objective met inside authorized scope;
- duplicated privileged headers equal zero;
- cross-origin auth leakage equal zero;
- VI deviation within tolerance;
- latency and performance budget within accepted range;
- proof bundle emitted.

LIMIT triggers:

- Octonion boundary breach;
- unauthorized scope expansion;
- policy conflict;
- resolver downgrade attempt;
- header-policy breach;
- missing rollback plan for mutating action.

## Metrics and SLOs

- DNS discipline: approved resolver path percentage and raw DNS count.
- Header minimality: mean header count and duplicate privileged headers.
- Cross-origin auth leakage: zero target.
- Omega impact: Omega-high percentage should decrease or be explained.
- VI fairness: allocation error within configured tolerance.
- Latency delta: within declared performance budget.
- Proof latency: V3-to-V5 and V7 sealing within configured target.

## Proof artifact shape

```yaml
artifact: cloak.proof
capability: whisper.egress.cloak
specVersion: 1.0.0
inputs:
  vi: SHA256:<digest>
  policyBaseline: SHA256:<digest>
  headerReport: SHA256:<digest>
before:
  dnsRawPct: number
  omegaHighPct: number
after:
  dnsRawPct: number
  omegaHighPct: number
explain:
  - string
safety:
  scopeRef: string
  authorizationRef: string
  rollbackPlanRef: string
signatures: []
```

## Deployment posture

Whisper may be represented as:

- a Kubernetes sidecar for web-gateway policy evaluation;
- a DaemonSet or host-level control for owned lab environments;
- an eBPF or nftables-adjacent policy consumer where approved;
- a CI policy-diff checker;
- a dry-run report generator.

All deployment modes require Warden policy gate and rollback posture.

## Tests

Required test classes:

- unit tests for header de-duplication;
- unit tests for cross-origin auth stripping;
- policy tests for CSP/COOP/COEP baseline;
- integration tests for approved resolver discipline;
- negative tests for resolver failure and downgrade refusal;
- canary tests for latency and error budgets;
- proof-shape validation.

## LSA / LSI anchoring

Relevant topics:

- Topic 2: Android harness / nano-C2 profiles;
- Topic 9: Header typing and Omega scoring;
- Topic 10: JA3 / QUIC / qlog enrichment;
- Topic 11: Info fields and capability scoping;
- Topic 12: Egress economy / VI allocator.

Prime anchors:

- p2 netns;
- p5 h2;
- p7 h3;
- p11 JA3;
- p13 SNI;
- p19 DoH;
- p23 Omega high;
- p29 allocation;
- p31 proof.

## CI and drift guard

Promotion to enforced posture should require:

1. `cloak.proof.json`;
2. `policy.pack.json`;
3. `egress_economy.report.json`;
4. `dns_safety.report.json`;
5. SBOM and container/image digest refs where applicable;
6. drift diff between IaC and live state where applicable;
7. FROST or promotion ballot pack where required;
8. Michael Heller signoff for elevated engagement or scope expansion until delegated policy exists.

## Failure modes

- resolver outage;
- resolver downgrade attempt;
- header rule conflict;
- JA3/ALPN mismatch;
- excessive latency;
- VI starvation;
- missing rollback;
- policy drift;
- overbroad scope.

## Completion definition

Whisper is implementation-backed only when it has:

- `whisper-config.schema.json`;
- `whisper-cloak-proof.schema.json`;
- example config;
- example proof;
- validation in CI;
- safety invariants;
- Warden gate linkage;
- rollback proof shape.

Until then, this document is canonical prose capture, not runtime implementation.
