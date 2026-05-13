# Devine Intelligence Wargames — LSA / LSI Topic Map

Status: v0.1 canonical capture  
Canonical program: Devine Intelligence Wargames  
Owner plane: topic spine, learning surface, dashboard anchors, ontology export, and schema backlog  
Implementation state: prose capture only; machine-readable map and CI validation pending

## Purpose

This document captures the canonical 23-topic LSA/LSI map for Devine Intelligence Wargames.

The 23-topic map is the shared spine across:

- DEFENSE mode;
- LEARNING mode;
- agent roles;
- Boundary Cyber Hypergraph evidence;
- Ontogenesis semantic reasoning;
- MeshRush graph views;
- HellGraph proof/replay streams;
- OFIF / Orion client-facing intelligence;
- dashboards;
- schema and example backlogs.

The map gives every topic:

- objective;
- signal vocabulary;
- LSA-10 subspace;
- LSI prime anchors p2..p31;
- operational interpretation;
- implementation targets.

## Global LSA scaffold

### Corpus sources

The Wargames corpus should include:

- Genesys specifications;
- Inception lab logs;
- Emergence sensor logs;
- PCAP-to-JSONL summaries;
- Falco / osquery / udev outputs;
- qlog enrichment where available;
- policy files;
- proof artifacts;
- boundary events;
- findings;
- font/rendering reports;
- agent manifests;
- Memphis governance records;
- OFIF field-intelligence summaries;
- Ontogenesis JSON-LD and SHACL validation outputs;
- MeshRush graph-view exports;
- HellGraph replay summaries.

### Preprocessing

Recommended preprocessing:

- TF-IDF over text tokens and structured fields;
- preserve protocol idioms such as `alpn:h2`, `ja3`, `quic.version`, `font-src`, `vkms`, `edid`, `pcr`, `frost`, `proof_ref`;
- preserve key-value pairs where semantically important;
- add bigrams for protocol and policy phrases;
- keep `topicRefs`, `phaseRefs`, `surfaceRefs`, and `agentRefs` as structured tags;
- separate DEFENSE and LEARNING corpora while preserving trace links.

### Decomposition

- Global macro map: rank-23 LSA.
- Per-topic drilldown: rank-10 LSA.
- LSI anchors: 11 stable prime labels per topic.
- LDA expansion: permitted only after topic coverage is stable and redaction rules pass.

### Prime vector set

The stable prime vector set is:

```text
P = {2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31}
```

Use labels:

```text
p2, p3, p5, p7, p11, p13, p17, p19, p23, p29, p31
```

Prime anchors are durable references for dashboards, examples, ontology classes, topic heatmaps, and agent routing. They should not drift casually.

## Canonical topics

## 1. GIE Rollout

Objective: immutable provenance from offline seed to lab to perimeter.

Signals:

- `spec_version`;
- signatures;
- validator quorum;
- bundle hashes;
- handoff events;
- rollback posture.

LSA-10:

1. provenance;
2. validators;
3. artifact hashes;
4. policy sync;
5. ring boundaries;
6. countersignature;
7. drift delta;
8. handoff events;
9. replayability;
10. quarantine.

LSI anchors:

- p2 seed keys;
- p3 spec yaml;
- p5 sha chain;
- p7 quorum;
- p11 attestation text;
- p13 airgap;
- p17 handoff media;
- p19 public key;
- p23 timebox;
- p29 rollback;
- p31 revoke.

## 2. Android VM and nano-C2 Profiles

Objective: reproduce adversary-shaped guest behavior safely and measurably with synthetic/lab-only profiles.

Signals:

- netns;
- veth;
- emulator;
- Waydroid;
- h2;
- ws;
- h3;
- DoH;
- jitter;
- padding.

LSA-10:

1. namespace;
2. egress allow;
3. jitter model;
4. periodicity;
5. padding bucket;
6. DoH discovery;
7. QUIC version;
8. SNI front;
9. websocket path;
10. profile manifest.

LSI anchors:

- p2 netns;
- p3 veth;
- p5 emulator;
- p7 waydroid;
- p11 h2;
- p13 ws;
- p17 h3;
- p19 doh;
- p23 padding;
- p29 jitter;
- p31 pin_ip.

## 3. Reverse-Tether / Relay Audit

Objective: detect and govern host/guest egress ambiguity and relay patterns in approved environments.

Signals:

- adb;
- relay service;
- host NAT;
- TLS ClientHello skew;
- namespace pin;
- mirror pcap;
- production ban.

LSA-10:

1. adb present;
2. relay fingerprint;
3. host NAT;
4. TLS client shape;
5. SNI blend;
6. packet timing;
7. namespace pin;
8. policy tag;
9. mirror pcap;
10. alert on prod.

LSI anchors:

- p2 adb;
- p3 relay;
- p5 5037;
- p7 nat;
- p11 tlsCH;
- p13 sni;
- p17 mirror;
- p19 policy tag;
- p23 prod ban;
- p29 dev box;
- p31 camo.

## 4. Huginn / Autoscout Orchestration

Objective: declarative micro-flows to drive, observe, schedule, and report Wargames phases.

Signals:

- agent graph;
- cron cadence;
- webhook events;
- tag headers;
- audit trails;
- queue depth;
- policy gates.

LSA-10:

1. agent graph;
2. cadence;
3. tag header;
4. retry backoff;
5. artifact emit;
6. scope guard;
7. audit trail;
8. secret handling;
9. queue depth;
10. policy gate.

LSI anchors:

- p2 flow;
- p3 cron;
- p5 webhook;
- p7 tags;
- p11 retries;
- p13 emits;
- p17 scope;
- p19 audit;
- p23 secrets;
- p29 backlog;
- p31 gate.

## 5. Multifeed Replication / Hypercore-Style State

Objective: model resilient, low-signal, append-only state replication and proof-leaf diffusion.

Signals:

- append-only feeds;
- peer set;
- chunk size;
- churn;
- Merkle height;
- reconnects;
- tombstones;
- fixed peers.

LSA-10:

1. append rate;
2. peer degree;
3. chunk entropy;
4. Merkle height;
5. reconnects;
6. clock skew;
7. backlog;
8. noise profile;
9. tombstones;
10. fixed peers.

LSI anchors:

- p2 append-only feed;
- p3 peers;
- p5 chunks;
- p7 churn;
- p11 Merkle;
- p13 reconnect;
- p17 skew;
- p19 backlog;
- p23 tombstone;
- p29 noise;
- p31 pinned peer.

## 6. KDE Connect / Side-Channel Bridges

Objective: contain clipboard, file, notification, and input bridges.

Signals:

- dbus calls;
- pair events;
- file push;
- clipboard sync;
- input emulation;
- subnet scope;
- auth material.

LSA-10:

1. pair trust;
2. dbus audit;
3. file push;
4. clipboard sync;
5. input injection;
6. host allow;
7. subnet scope;
8. notification relay;
9. auth material;
10. policy enforcement.

LSI anchors:

- p2 pair;
- p3 dbus;
- p5 file;
- p7 clipboard;
- p11 input;
- p13 allowlist;
- p17 subnet;
- p19 notify;
- p23 auth;
- p29 audit;
- p31 deny.

## 7. Virtual Display and PipeWire Guards

Objective: expose hidden UI sessions, virtual displays, screencasts, and rendering-related surface drift.

Signals:

- DRM change;
- EDID hash;
- xrandr delta;
- PipeWire node;
- portal policy;
- hotplug rate;
- headless execution;
- screencast tag.

LSA-10:

1. EDID whitelist;
2. vkms/evdi load;
3. xrandr signature;
4. PipeWire node;
5. portal policy;
6. hotplug rate;
7. headless run;
8. screencast tag;
9. false dock;
10. business hours.

LSI anchors:

- p2 drm;
- p3 edid;
- p5 xrandr;
- p7 vkms;
- p11 evdi;
- p13 portal;
- p17 pipewire node;
- p19 headless;
- p23 dock;
- p29 hours;
- p31 alert.

## 8. DOT Deepfake and Liveness

Objective: pressure-test persona binding, liveness, and virtual-camera risk under safe review conditions.

Signals:

- virtual camera;
- pose;
- blink;
- challenge response;
- A/V sync;
- failure modes;
- FAR / FRR.

LSA-10:

1. challenge pool;
2. desync score;
3. blink rate;
4. pose variance;
5. audio hash;
6. attested camera;
7. failure modes;
8. false accept;
9. reviewer latency;
10. capture chain.

LSI anchors:

- p2 vcam;
- p3 pose;
- p5 blink;
- p7 avhash;
- p11 attested;
- p13 challenge;
- p17 desync;
- p19 FAR;
- p23 FRR;
- p29 review;
- p31 chain.

## 9. Header Typing and Omega Scoring

Objective: classify flows without payload bodies and produce explainable signal scores.

Signals:

- periodicity;
- header minimality;
- ALPN h2/h3;
- JA3 stability;
- QUIC version;
- SNI stability;
- DoH hints.

LSA-10:

1. periodicity;
2. header minimality;
3. ALPN family;
4. QUIC presence;
5. JA3 stability;
6. SNI stability;
7. domain-front similarity;
8. size entropy;
9. DoH hint;
10. Omega band.

LSI anchors:

- p2 periodicity;
- p3 minimality;
- p5 h2;
- p7 h3;
- p11 ja3;
- p13 sni;
- p17 quic;
- p19 doh;
- p23 omega high;
- p29 omega medium;
- p31 omega low.

## 10. JA3 / QUIC / qlog Enrichment

Objective: add stronger handshake and transport fingerprint context.

Signals:

- ClientHello suites;
- extensions;
- groups;
- EC points;
- QUIC version;
- qlog spin/loss hints;
- congestion hints.

LSA-10:

1. JA3 raw;
2. MD5 fingerprint;
3. suite profile;
4. extension profile;
5. group profile;
6. QUIC spin;
7. congestion hints;
8. loss signal;
9. version idiom;
10. family map.

LSI anchors:

- p2 ja3;
- p3 suites;
- p5 extensions;
- p7 groups;
- p11 EC points;
- p13 spin;
- p17 loss;
- p19 congestion;
- p23 version;
- p29 family;
- p31 map.

## 11. Info Fields / Capability Scoping

Objective: bound inference by bounding agent visibility.

Signals:

- flows visibility;
- headers visibility;
- tasks-only scope;
- namespace scope;
- cgroup scope;
- bus scope;
- proof of scope;
- denial log.

LSA-10:

1. flows view;
2. headers view;
3. tasks only;
4. namespace scope;
5. cgroup scope;
6. bus scope;
7. proof of scope;
8. denial log;
9. cross-context glue;
10. auditability.

LSI anchors:

- p2 flows;
- p3 headers;
- p5 tasks;
- p7 namespace;
- p11 cgroup;
- p13 bus;
- p17 proof;
- p19 deny;
- p23 glue;
- p29 audit;
- p31 capability.

## 12. Egress Economy / VI Allocator

Objective: fair, explainable egress budgets without brittle throttles.

LSA-10:

1. producer rate;
2. transporter capacity;
3. consumer capacity;
4. price;
5. backlog;
6. violation;
7. convergence step;
8. async update;
9. contention epoch;
10. final allocation.

LSI anchors:

- p2 producer;
- p3 transporter;
- p5 consumer;
- p7 price;
- p11 backlog;
- p13 violation;
- p17 step;
- p19 async;
- p23 epoch;
- p29 allocation;
- p31 proof.

## 13. HPST Tomography and Agent Grading

Objective: detect overconfidence, drift, grounding weakness, tool misuse, and poor abstention.

LSA-10:

1. calibration;
2. consistency;
3. grounding;
4. counterfactual;
5. tool discipline;
6. abstention;
7. archetype mix;
8. drift metric;
9. dossier rollup;
10. thresholds.

LSI anchors:

- p2 ECE;
- p3 z vector;
- p5 overconfidence;
- p7 drift;
- p11 mix;
- p13 abstain;
- p17 counterfactual;
- p19 tool;
- p23 grounding;
- p29 judge;
- p31 cap.

## 14. Two-Witness FROST Knowledge Promotion

Objective: require quorum for canonization and keep dissent visible.

LSA-10:

1. claim text;
2. evidence refs;
3. partials;
4. aggregate;
5. quorum;
6. witness diversity;
7. revocation;
8. appeal;
9. canon state;
10. publish route.

LSI anchors:

- p2 claim;
- p3 partial;
- p5 aggregate;
- p7 quorum2;
- p11 diversity;
- p13 revoke;
- p17 appeal;
- p19 canon;
- p23 route;
- p29 redact;
- p31 log.

## 15. CI Drift Guard and SPEC Control

Objective: prevent unapproved drift from Genesys/SPEC.

LSA-10:

1. baseline;
2. hash mismatch;
3. path scope;
4. PR gate;
5. action log;
6. remediation;
7. exception;
8. release tag;
9. changelog;
10. freeze.

LSI anchors:

- p2 baseline;
- p3 drift;
- p5 gate;
- p7 PR;
- p11 action;
- p13 exception;
- p17 release;
- p19 change;
- p23 freeze;
- p29 pin;
- p31 source of truth.

## 16. PQC Posture and Key Custody

Objective: future-proof cryptographic posture and bind secrets to measured state.

LSA-10:

1. KEM hybrid;
2. PQ signature;
3. TPM unseal;
4. UKI boot;
5. SSH/FIDO;
6. artifact signing;
7. rotate;
8. revoke;
9. custody handle;
10. inventory.

LSI anchors:

- p2 kyber;
- p3 x25519;
- p5 dilithium;
- p7 slh;
- p11 tpm;
- p13 uki;
- p17 fido;
- p19 sign;
- p23 rotate;
- p29 revoke;
- p31 inventory.

## 17. Attestation and Measured Boot

Objective: ensure known-good sensors and defensive components run visibly.

LSA-10:

1. PCR map;
2. UKI signature;
3. module signature;
4. policy hash;
5. quote;
6. attestor;
7. deny boot;
8. recovery;
9. audit chain;
10. visible boot.

LSI anchors:

- p2 pcr;
- p3 uki;
- p5 module signature;
- p7 policy;
- p11 quote;
- p13 attestor;
- p17 deny;
- p19 recover;
- p23 audit;
- p29 visible;
- p31 prove.

## 18. Publishing and Provenance

Objective: signed reproducible reports with traceable sources.

LSA-10:

1. markdown normalization;
2. djot conversion;
3. renderer;
4. seal;
5. provenance link;
6. density;
7. PDF hash;
8. plate refs;
9. version banner;
10. readability.

LSI anchors:

- p2 md;
- p3 djot;
- p5 shifu;
- p7 sigil;
- p11 whyis;
- p13 plate;
- p17 base-e;
- p19 pdf hash;
- p23 banner;
- p29 density;
- p31 cite.

## 19. Ontology / AtomSpace / SHACL

Objective: precise types and constraints for agents, flows, evidence, policies, claims, and controls.

LSA-10:

1. type tree;
2. SHACL shape;
3. atom type;
4. flow class;
5. header class;
6. claim type;
7. evidence link;
8. policy type;
9. agent capability;
10. violation.

LSI anchors:

- p2 type;
- p3 shape;
- p5 atom;
- p7 flow;
- p11 header;
- p13 claim;
- p17 evidence;
- p19 policy;
- p23 agent;
- p29 capability;
- p31 violation.

## 20. Graph / Topo Forensics

Objective: preserve higher-order relations under noise.

LSA-10:

1. simplex rank;
2. hyperedge;
3. boundary operator;
4. WL hash;
5. kernel distance;
6. persistence pair;
7. community;
8. bridge edge;
9. motif;
10. explainability.

LSI anchors:

- p2 simplex;
- p3 hyper;
- p5 boundary;
- p7 WL;
- p11 kernel;
- p13 persistence;
- p17 community;
- p19 bridge;
- p23 motif;
- p29 explain;
- p31 court.

## 21. Generative Search / GFlowNets

Objective: sample diverse high-reward defensive hypotheses without mode collapse.

LSA-10:

1. reward shape;
2. flow balance;
3. coverage;
4. novelty;
5. constraint ok;
6. safety guard;
7. seed set;
8. lexicon fit;
9. dead end;
10. archive.

LSI anchors:

- p2 flow;
- p3 reward;
- p5 coverage;
- p7 novelty;
- p11 safety;
- p13 seed;
- p17 lexicon;
- p19 dead end;
- p23 archive;
- p29 bound;
- p31 audit.

## 22. Quantum-Inspired Toolkits

Objective: use variational and structure-preserving optimization ideas safely.

LSA-10:

1. entanglement band;
2. variational loop;
3. shadow effect;
4. QMC error;
5. sampler mix;
6. loss landscape;
7. anneal schedule;
8. certified relaxation;
9. classical bridge;
10. pedagogy.

LSI anchors:

- p2 MPS;
- p3 DMRG;
- p5 QMC;
- p7 shadow;
- p11 variational;
- p13 loss;
- p17 anneal;
- p19 relax;
- p23 bridge;
- p29 pedagogy;
- p31 safe.

## 23. DevEx and Editors

Objective: deterministic editing, sealed plugins, safe autoscouts, and reproducible workspaces.

LSA-10:

1. plugin lock;
2. LSP latency;
3. triRPC bridge;
4. autoscout;
5. snippet security;
6. workspace hash;
7. keymap normalization;
8. diff hint;
9. crashproof;
10. hermetic.

LSI anchors:

- p2 zed;
- p3 nvim;
- p5 sha;
- p7 lsp;
- p11 trpc;
- p13 scout;
- p17 hermetic;
- p19 crash;
- p23 diff;
- p29 keymap;
- p31 workspace.

## Cross-topic edges

Initial canonical edges:

- Topic 9 periodicity -> Topic 12 contention epoch.
- Topic 11 flows view -> Topic 13 calibration.
- Topic 7 virtual display driver changes -> Topic 15 drift investigation.
- Topic 14 quorum -> Topic 18 publish route.
- Topic 20 persistence pair -> Topic 21 coverage.
- Topic 15 SHA drift -> Topic 18 version banner.
- Topic 16 key rotation -> Topic 17 attestation.
- Topic 19 SHACL violation -> Topic 20 hyperedge.
- Topic 21 novelty -> Topic 22 pedagogy.
- Topic 23 plugin lock -> Topic 18 markdown normalization.

## DEFENSE mode use

In DEFENSE mode, the map supports:

- coverage accounting;
- evidence routing;
- agent tasking;
- posture summaries;
- ATT&CK coverage explanation;
- policy gap detection;
- dynamic engagement trigger context;
- OFIF client-facing summaries.

## LEARNING mode use

In LEARNING mode, the map supports:

- corpus labeling;
- LSA coherence measurement;
- LDA expansion control;
- grammar and SHACL tests;
- reproducibility checks;
- pedagogy pathways;
- redacted training data production.

## Machine-readable backlog

Required next artifact:

`examples/scope-d/wargames-lsa-map.example.json`

Future schema:

`config/schemas/wargames-lsa-lsi-map.schema.json`

Required validation checks:

- exactly 23 topics;
- each topic has 10 LSA dimensions;
- each topic has 11 LSI prime anchors;
- all prime anchors use p2..p31;
- topic IDs are unique;
- cross-topic edges reference valid topics and dimensions;
- DEFENSE / LEARNING usage fields exist;
- redaction and disclosure rules exist for LEARNING exports.

## Completion definition

This map is implementation-backed only when it exists as a validated JSON artifact, is wired into CI, and is consumable by Ontogenesis, OFIF, MeshRush, and dashboards. Until then, this document is canonical prose capture, not machine implementation.
