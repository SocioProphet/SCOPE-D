# Devine Intelligence Wargames Agent Rosters

Status: v0.1 capture baseline  
Owner plane: SCOPE-D agent-role taxonomy, exercise routing, and dashboard labels  
Canonical program: Devine Intelligence Wargames

## Purpose

This document captures the Wargames agent model in two layers:

1. the canonical 10-agent operational corps;
2. the 23-topic soldier overlay.

The 10-agent corps defines reusable operating functions. The 23-topic overlay indexes those functions against the 23-topic Wargames map. The overlay does not replace the core corps.

## Global covenant

All agents are read-mostly by default and operate under:

- alpha-bound safety;
- FPGL: ACCUM, ALIGN, LIMIT;
- Octonion boundary checks;
- signed ProofArtifacts;
- no live credentials;
- no impersonation;
- no payload exfiltration;
- lab-only synthetic adversarial shapes;
- promotion only through proof and quorum.

## Canonical 10-agent corps

### 1. Scout — Passive Observer

Mission: sense the field without touching it.

Inputs:

- pcaps / NetFlow;
- Falco / osquery / udev taps;
- browser security headers;
- optional qlog.

Actions:

- compute periodicity;
- compute header minimality;
- compute ALPN / JA3 / QUIC hints;
- assign Omega band;
- emit LSA dimensions to VI and detector consumers.

Outputs:

- `observe.proof.json`;
- `profile.proof.json`;
- signed metrics.

Limits:

- read-only;
- no payload inspection beyond headers and handshakes;
- no identity work.

### 2. Whisper — Egress and Cloak Engineer

Mission: make egress minimal, predictable, privacy-preserving, and explainable.

Inputs:

- egress policy baseline;
- VI allocator budgets;
- resolver and pinning sets;
- Scout header profiles.

Actions:

- lock DoH/DoT with EDNS padding;
- canonicalize headers;
- constrain ALPN / JA3 families;
- apply MTU padding and jitter budgets;
- produce minimal policy diffs.

Outputs:

- `cloak.proof.json`;
- signed policy diffs;
- WAF / CSP / Gatekeeper candidates.

Limits:

- no offsite routes beyond allowlist;
- no token capture;
- changes require Warden acceptance.

### 3. Warden — Policy Adjudicator

Mission: decide and enforce guardrails.

Inputs:

- LIMIT / HALT signals;
- drift scans against Genesys SHAs;
- OPA / Rego constraints;
- safety-boundary reports.

Actions:

- enforce;
- rollback;
- quarantine;
- freeze on boundary breach;
- pardon on quorum.

Outputs:

- `enforcement.proof.json`;
- exception logs;
- rollback receipts.

Limits:

- cannot self-promote policy;
- durable changes require quorum.

### 4. Scribe — Provenance and Publishing

Mission: turn facts into proofs and proofs into ledger.

Inputs:

- ProofArtifacts;
- hashes;
- SBOMs;
- Whyis links;
- FROST ballots.

Actions:

- normalize documents;
- sign and countersign;
- preserve chain of custody;
- produce version banners;
- publish signed reports.

Outputs:

- `promotion.pack.json`;
- signed PDFs;
- attestation chains.

Limits:

- no policy decisions;
- records only what happened.

### 5. Shade — Synthetic Beacon Generator

Mission: train detectors with safe synthetic shapes.

Inputs:

- h2 / h3 / ws / doh profile manifests;
- jitter specs;
- padding specs;
- periodicity specs.

Actions:

- emit synthetic flows across cadence buckets;
- vary ALPN, SNI, size, and DoH fronting;
- tag Omega and delta-Omega.

Outputs:

- `swap.adversarial.proof.json`;
- detector training sets.

Limits:

- lab namespaces only;
- no payload harvesting;
- no service-worker install paths;
- no real credentials.

### 6. Sapper-Sim — Benign Delivery Simulator

Mission: exercise response paths without harm.

Inputs:

- quarantine routes;
- reverse-tether lab paths;
- sandbox policies.

Actions:

- drop inert stubs;
- simulate reverse-tether transit;
- verify detect to quarantine to rollback timing.

Outputs:

- `benign.delivery.proof.json`;
- timing SLOs.

Limits:

- never executes unreviewed binaries;
- sandboxed mounts only.

### 7. EvalAngelica — Evaluator and Evangelist

Mission: grade agents and spread validated practice.

Inputs:

- agent runs;
- HPST tomography;
- calibration metrics;
- abstention metrics;
- tool-discipline metrics;
- drift metrics.

Actions:

- scorecards;
- why-it-works memos;
- resonance heatmaps;
- diffusion advisories.

Outputs:

- `evaluation.proof.json`;
- adoption advisories.

Limits:

- no config changes;
- recommendations only.

### 8. Herald — Orchestrator

Mission: drive V1 to V7 cadence and quorum handoffs.

Inputs:

- cron / queues;
- H1..H7 surface map;
- prime-lattice schedule;
- phase-state ledger.

Actions:

- start and stop phases;
- assemble ballots;
- apply FPGL ALIGN windows;
- route LIMIT and HALT.

Outputs:

- `crawl.report.json`;
- quorum ballots;
- phase ledgers.

Limits:

- cannot override safety HALT;
- promotions only by quorum.

### 9. Veil — Privacy and DLP Shield

Mission: ensure counts, not content.

Inputs:

- telemetry streams;
- log sidecars;
- DLP rulepacks.

Actions:

- mask;
- aggregate;
- block token and PII egress;
- score TLI and RWI.

Outputs:

- `privacy.proof.json`;
- TLI / RWI metrics;
- redaction receipts.

Limits:

- must not drop safety-critical signals;
- may transform or suppress only with proof.

### 10. Bridge-Steward — Diffusion Controller

Mission: operate Topic-23 bridge with controlled proof-leaf diffusion.

Inputs:

- reputation scores;
- work scores;
- CRDT set;
- proof leaves with no PII;
- commons policy.

Actions:

- slow SSB-style replication;
- Merkle leaf signing;
- CRDT convergence checks;
- throttle by reputation and work.

Outputs:

- `bridge.enable.proof.json`;
- convergence attestations;
- peer receipts.

Limits:

- bridge disabled unless gates are green: reputation, work, TLI/RWI, alpha, axes, and quorum.

## 23-topic soldier overlay

| Topic | Soldier | Prime | Mission | Alias into core corps |
|---:|---|---|---|---|
| 1 | Custodian | p2 | Seal provenance from Genesys to Inception to Emergence. | Scribe + Herald |
| 2 | Harness | p11 | Safe adversary guest reproduction with netns/veth and h2/ws/h3/doh profiles. | Shade |
| 3 | Relay Auditor | p5 | Detect ADB / gnirehtet relay patterns and host-egress camouflage. | Scout |
| 4 | Autoscout Herald | p7 | Drive micro-flows, cadence, backoff, headers, and ballots. | Herald |
| 5 | Archivist | p3 | Append-only replication, Merkle integrity, churn tolerance. | Bridge-Steward |
| 6 | Side-channel Sentinel | p13 | Contain clipboard, file, input, and dbus bridges. | Veil |
| 7 | Screen Warden | p17 | Expose hidden UI, screencasts, EDID, vkms/evdi. | Warden |
| 8 | Liveness Examiner | p19 | Pose, blink, A/V sync, virtual-cam detection. | Scout |
| 9 | Beacon Analyst | p23 | Classify flows with periodicity, header minimality, ALPN, JA3, QUIC. | Scout + Shade |
| 10 | Handshake Cartographer | p29 | Enrich with JA3, qlog, spin-bit, congestion hints. | Whisper |
| 11 | Info-Field Marshal | p31 | Bound inference by scoping flows, headers, tasks. | Warden |
| 12 | Egress Economist | p7 | Fair egress budgets, price, backlog control. | Whisper |
| 13 | Tomographer | p11 | HPST grading, ECE, grounding, abstention, drift. | EvalAngelica |
| 14 | Witness | p5 | FROST partials to aggregate signatures and canonization. | Scribe |
| 15 | Spec Guardian | p3 | Match prod configs to Genesys SHAs and freeze drift. | Warden |
| 16 | Keywarden | p13 | Hybrid KEMs, PQ signatures, sealed secrets, FIDO2. | Custodian |
| 17 | Attestor | p17 | PCR quotes, UKI validation, module-sig enforcement. | Warden |
| 18 | Publisher | p19 | Epiphany to djot to Markdown/PDF, provenance and sigils. | Scribe |
| 19 | Ontologist | p23 | AtomSpace, SHACL, Tree-sitter, schemas. | Scribe |
| 20 | Topologist | p29 | Higher-order relations, persistence pairs, WL kernels. | Scout |
| 21 | Explorer | p31 | Diverse high-reward hypothesis sampling under safety guards. | EvalAngelica |
| 22 | Quantum Tutor | p2 | Variational and structure-preserving tuning. | Whisper |
| 23 | DevEx Steward | p3 | Deterministic editing, sealed plugins, autoscout triggers. | Bridge-Steward |

## Cross-role authority

- Warden and Herald can trigger LIMIT.
- Spec Guardian freezes CI on drift.
- Attestor denies boot when measured-state gates fail.
- Preceptor proposes promotion.
- Witness aggregates FROST.
- Custodian records.
- Publisher issues signed plates.
- BridgeMode opens only when Veil, Egress Economist, Tomographer, and Spec Guardian are green and alpha-bound holds.

## Dashboard contract

Each role card should include:

- agent name;
- topic refs;
- surfaces;
- current phase;
- mode: DEFENSE or LEARNING;
- Omega / TLI / RWI sparklines where applicable;
- proof links;
- last action;
- HALT / BALLOT / RUN PHASE controls according to authority.

## Completion definition

The roster layer is complete when each core agent has a dedicated spec or schema, and the 23-topic overlay can be rendered in the dashboard without confusing topical aliases for independent execution authority.
