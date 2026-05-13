# Scout Agent Spec

Status: v0.1 canonical capture  
Agent: Scout  
Canonical program: Devine Intelligence Wargames  
Role: Passive observer and profiler  
Primary surfaces: H1..H7 — Mobile, Network, Host, Browser, Cloud, Storage, Boot  
Primary phases: V1 Observe, V2 Profile  
Implementation state: prose capture only; schema/example/CI backlog

## Purpose

Scout is the Wargames agent responsible for passive observation, posture profiling, header/handshake feature extraction, Omega-band scoring, and signed proof generation.

Scout supplies the read-only evidence stream consumed by Whisper, Warden, Scribe, Ontogenesis, MeshRush, HellGraph, OFIF, and the Wargames DEFENSE/LEARNING loop.

Scout must never mutate systems, exploit targets, impersonate identities, harvest tokens, inspect payload bodies, or open untrusted content.

## Mission

Observe and profile shapes of communication and posture without altering systems or users. Produce auditable, signed Event-IR and ProofArtifacts that feed detectors, policy gates, dashboards, LSA/LSI topic maps, and promotion decisions.

## Non-goals

Scout must not:

- exploit;
- impersonate;
- collect credentials;
- inspect payload bodies beyond allowed headers and handshake metadata;
- perform live content exfiltration;
- mutate systems outside its own workdir/log/proof path;
- approve policy;
- perform containment;
- initiate dynamic engagement above E1.

## Safety covenant

Scout inherits global Wargames controls:

- alpha-bound safety;
- Octonion boundary checks;
- FPGL gates: ACCUM, ALIGN, LIMIT;
- read-only default posture;
- signed Event-IR and ProofArtifacts;
- privacy minimization;
- payload avoidance;
- redaction for SNI, DNS, and other sensitive metadata where required;
- Michael Heller signoff for elevated engagement or scope expansion until delegated policy exists.

## Responsibilities

### V1 Observe

Passive capture and telemetry collection:

- pcap-to-JSONL header extraction;
- NetFlow or equivalent flow summaries;
- system posture from read-only taps such as osquery, Falco, udev, or platform-native telemetry;
- browser CSP and service-worker inventory;
- DNS and DoH posture;
- optional qlog enrichment;
- optional PipeWire / virtual-display node inventory;
- evidence source hashing.

### V2 Profile

Feature derivation and profile generation:

- periodicity;
- header minimality;
- ALPN family;
- QUIC presence;
- JA3 stability;
- SNI stability;
- DoH hints;
- size entropy where available without payload inspection;
- Omega bands;
- per-surface summaries;
- LSA/LSI anchor emission;
- signed profile proof.

## Deliverables

Per sweep, Scout should emit:

- `events/scout.event.ir.jsonl`;
- `features/headers.jsonl`;
- `features/beacon_report.jsonl`;
- `proofs/scout.observe.proof.json`;
- `proofs/scout.profile.proof.json`;
- optional `features/qlog_features.jsonl`;
- optional `features/display_surface.jsonl`.

## Interfaces

### triRPC control plane

```proto
service Scout {
  rpc StartSweep(StartSweepReq) returns (SweepRef);
  rpc StopSweep(StopSweepReq) returns (ProofArtifactRef);
  rpc GetProof(GetProofReq) returns (ProofArtifact);
  rpc StreamEvents(StreamEventsReq) returns (stream EventIR);
}
```

Minimum request fields:

```yaml
StartSweep:
  surfaces: []
  windowSeconds: number
  iface: string
  namespace: string
  scopeRef: string
  safetyBoundaryRef: string
```

### CLI surface

```bash
scout observe --iface veth-host --out /var/log/scout --rotate 300
scout profile --in /var/log/scout/guest_*.pcap --out /var/log/scout
```

## Event-IR shape

```yaml
ts: number
surface: H2
kind: net.header
src: 10.200.0.2
dst: 1.1.1.1
proto: tcp
srcPort: 52344
dstPort: 443
alpn: h2
sni: cdn.example.com
quicVersion: null
tlsJa3: e7d705...
http2HeaderLen: 34
dnsQueryName: null
tags:
  - lab
  - guestns
trace:
  pcapFile: /var/log/scout/guest_20251105_0000.pcap
  offset: 12345
redactionState: redacted
```

## Header feature shape

```yaml
flowKey: 10.200.0.2>cdn.example.com:443/tcp
score: 0.812
omega: Omega.hi
features:
  periodicity: 0.86
  headerMinimality: 0.72
  alpnH2: 1.0
  quicHint: 0.0
  sniStability: 1.0
  ja3Stability: 1.0
  packetCount: 134
```

## ProofArtifact shape

```yaml
kind: scout.profile.proof
sweepId: scout-2025-11-05T00:00Z
surfaces:
  - H2
  - H4
windowSeconds: 3600
inputs:
  pcaps:
    - /var/log/scout/guest_*.pcap
  schema: scout.event.ir@1
  hashes:
    pcapGlobSha256: "..."
metrics:
  flows: 492
  omega:
    hi: 7
    med: 42
    lo: 443
anchors:
  lsi:
    - p2
    - p3
    - p5
    - p7
    - p11
    - p13
    - p17
    - p19
    - p23
    - p29
    - p31
  lsaDims:
    - L1
    - L2
    - L3
    - L4
    - L5
    - L6
policy:
  alphaBound: 0.00730
  octonionAxes:
    privacy: 0.2
    performance: 0.1
signatures:
  minisign: RWQ...
  validators:
    - human-1
    - human-2
    - human-3
```

## Processing pipeline

1. Capture bounded rolling files or read equivalent read-only telemetry.
2. Extract headers and handshakes to JSONL.
3. Compute feature vectors.
4. Assign Omega bands.
5. Profile by surface.
6. Emit LSA/LSI anchors.
7. Generate proof artifact.
8. Hash and sign.
9. Hand off to Whisper, Warden, Scribe, Boundary Hypergraph, and Ontogenesis.

## Performance guard

Defaults:

- CPU at or below 20 percent;
- disk at or below 10 GiB per day;
- capture rotation every 5 minutes;
- backpressure stops capture on quota;
- sampling must be documented when full capture is not appropriate.

## Privacy and DLP

Scout must minimize sensitive data:

- no HTTP or application payload bodies by default;
- no token retention;
- no Authorization or Cookie retention;
- SNI and DNS may be suffix-kept with salted hash of full label;
- sensitive identifiers should be transformed to proof-preserving digests;
- sampling windows and quotas enforce minimization;
- Veil may require stricter redaction.

## LSA / LSI mapping

Primary topic: Topic 9 — Header typing and Omega scoring.

LSA dimensions:

- L1 periodicity;
- L2 header minimality;
- L3 ALPN family;
- L4 QUIC presence;
- L5 JA3 stability;
- L6 SNI stability;
- L7 domain-front similarity;
- L8 size entropy;
- L9 DoH hint;
- L10 Omega band.

LSI anchors:

- p2 periodicity;
- p3 minimality;
- p5 h2;
- p7 h3;
- p11 JA3;
- p13 SNI;
- p17 QUIC;
- p19 DoH;
- p23 Omega high;
- p29 Omega medium;
- p31 Omega low.

## Boundary Hypergraph mapping

Scout observations should compile into boundary events where possible.

Examples:

- `dns_query` boundary event;
- `connect` boundary event;
- `request` boundary event;
- `response` boundary event;
- `sensor_access` boundary event;
- `module_load` observation;
- `font_load` observation;
- `document_open` observation.

Scout does not decide enforcement. It emits evidence, expectations, missing evidence, and findings for Warden and downstream systems.

## DEFENSE mode

DEFENSE mode uses Scout for:

- telemetry coverage;
- Omega scoring;
- boundary-event evidence;
- detection feature extraction;
- posture snapshots;
- proof-backed incident context.

DEFENSE mode may correlate authorized security evidence across accounts, devices, sessions, services, and artifacts when required for cyber defense.

## LEARNING mode

LEARNING mode uses Scout for:

- redacted corpora;
- feature intuition;
- LSA/LSI topic maps;
- grammar and SHACL fixtures;
- detector training examples;
- reproducibility exercises.

LEARNING outputs must preserve redaction and disclosure boundaries.

## Promotion criteria

V1 to V2 requires:

- at least 90 percent schema-valid Event-IR;
- at least 95 percent coverage of target edges unless scope says otherwise;
- privacy axes below configured threshold;
- quotas green;
- proof artifact emitted.

V2 seal requires:

- signed profile proof;
- hashes present;
- redaction state declared;
- safety-boundary ref declared;
- validators recorded where promotion requires it.

## Failure modes

- high disk or CPU;
- privacy spike;
- schema drift;
- overcollection;
- undercollection;
- clock skew;
- missing source hashes;
- Wayland / display telemetry noise;
- JA3 extraction inconsistency;
- qlog availability variance.

FPGL response:

- ACCUM: damp collection rate;
- ALIGN: increase redaction, fix schema, adjust sampling;
- LIMIT: halt surface capture or sweep when boundaries are breached.

## Tests

Required test classes:

- JSONL parse test;
- Event-IR schema test;
- feature calculation test;
- Omega band test;
- redaction test;
- quota test;
- proof-shape test;
- handoff test to Whisper/Warden;
- negative test for payload/body retention;
- replay test for deterministic profile generation.

## Roadmap

- qlog ingestion for QUIC spin-bit and loss hints;
- optional eBPF capture module for production-safe sampling;
- raw ClientHello parser independent of tshark build variance;
- incremental streaming Omega updates;
- BoundaryEvent schema integration;
- Ontogenesis JSON-LD export;
- MeshRush graph-view export;
- HellGraph proof stream compatibility.

## Completion definition

Scout is implementation-backed only when it has:

- `scout-event-ir.schema.json`;
- `scout-profile-proof.schema.json`;
- example Event-IR;
- example profile proof;
- validation in CI;
- redaction and quota invariants;
- BoundaryEvent handoff example;
- Whisper/Warden handoff example.

Until then, this document is canonical prose capture, not runtime implementation.
