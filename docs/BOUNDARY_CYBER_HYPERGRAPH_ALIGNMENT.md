# Boundary-Centric Cyber Hypergraph Alignment

Status: v0.1 capture baseline  
Owner plane: SCOPE-D evidence model, forensic graph layer, and negative-evidence semantics  
Canonical program: Devine Intelligence Wargames

## Purpose

This document aligns the boundary-centric cyber hypergraph model with SCOPE-D. It makes the boundary the unit of truth. Interior churn is preserved as evidence, but decisions are made at ports, contracts, and boundary events.

This is the strongest operational evidence model in the uploaded Wargames corpus because it explicitly represents:

- cross-boundary behavior;
- negative evidence;
- missing expected records;
- tamper signals;
- artifact traversal;
- contracts and ports;
- topic tagging;
- replayable decision context.

## Authoritative model

```text
Component -> Port -> Contract -> BoundaryEvent
                              |
                              +-> Evidence
                              +-> Expectations
                              +-> Findings
                              +-> Artifacts
```

A `BoundaryEvent` is the authoritative externalized fact. Logs, artifacts, and internal traces attach as evidence. Missing logs and tamper indicators are not side notes; they are evidence records with explicit roles.

## Core entities

### Component

A component is any bounded actor or runtime locus.

Examples:

- device;
- operating system;
- application;
- browser profile;
- service;
- session;
- storage volume;
- control domain.

Minimum fields:

```yaml
component_id: string
type: device | os | app | service | profile | session | volume | control_domain
name: string
platform: desktop | mobile | server | browser
control_domain_id: string
topics: []
```

### Port

A port is an attachment point where boundary truth becomes observable.

Minimum fields:

```yaml
port_id: string
component_id: string
surface: network | identity | execution | storage | ui | content
direction: ingress | egress | bi
exec_layer: firmware | boot | kernel | system | user | sandbox
contract_id: string
topics: []
```

### Contract

A contract defines who may talk, how, at what rate, with what cryptographic and policy requirements.

Minimum fields:

```yaml
contract_id: string
name: string
version: string
allowed_peers: []
allowed_actions: []
capabilities: []
entitlements: []
rate_limits: []
crypto_requirements:
  tls: bool
  mtls: bool
  pinning: bool
expected_observables: []
control_domain_id: string
```

### BoundaryEvent

A boundary event is the canonical fact to which all evidence attaches.

Minimum fields:

```yaml
event_id: string
time: string
port_id: string
inside_component_id: string
outside_ref: string
surface: network | identity | execution | storage | ui | content
action: string
result: success | fail | denied
exec_layer_from: string
exec_layer_to: string
boundary: syscall | ipc | driver_attach | priv_escalation | none
platform: string
topics: []
mitre:
  tactic: string
  technique_id: string
bytes_in: number
bytes_out: number
status_code: number
latency_ms: number
artifact_refs: []
evidence_refs: []
observed: bool
completeness_score: number
inferred_by: string
contradictions: []
supports: []
```

## Evidence, expectations, and findings

### Evidence

Evidence links a boundary event to a log record, artifact, or expected-but-absent record.

```yaml
evidence_id: string
event_id: string
record_ref: string | null
role: direct | corroborating | contradictory | absent_expected
weight: number
explanation: string
window:
  start: string
  end: string
```

Negative evidence is encoded with:

```yaml
role: absent_expected
record_ref: null
```

This is critical for SCOPE-D because a missing audit event, missing module-load record, or missing session-start record can be as important as a present log line.

### Expectation

Expectations define what should happen.

```yaml
expectation_id: string
port_id: string
contract_id: string
when: selector
must_observe: selector
sources: []
required_fields: []
tolerance:
  duration: string
  count: number
severity: low | medium | high | critical
version: string
```

### Finding

Findings materialize expectation failures, contract violations, drift, tamper, or missing records.

```yaml
finding_id: string
rule_id: string
severity: info | low | medium | high | critical
time: string
subject_port_id: string
kind: MissingRecord | MissingField | Gap | SchemaDrift | TimeSkew | SignatureInvalid | BoundaryViolation
observed_values: {}
expected_values: {}
details: {}
topics: []
confidence: number
related_evidence_ids: []
```

## Artifact families

Artifacts are first-class content/state objects that traverse ports.

Shared fields:

```yaml
artifact_id: string
path_or_uri: string
hash: string
size_bytes: number
topics: []
provenance: {}
first_seen: string
last_seen: string
```

Families:

- `EmailMessage`;
- `FontFile`;
- `Document`;
- `Cookie`;
- `TokenStore`;
- `BrowserState`;
- `ConfigFile`;
- `Database`;
- `BinaryModule`;
- `LogStream`;
- `LogRecord`;
- `IngestRun`.

Artifacts attach to boundary events when they cross a port: `cookie_set`, `font_load`, `document_open`, `token_issue`, `module_load`, `config_change`, and similar verbs.

## Log integrity layer

SCOPE-D should treat log integrity as its own surface.

### LogStream

```yaml
stream_id: string
source_name: string
host: string
schema_version: string
expected_rate_hz: number
signature_scheme: hash_chain | sig_per_chunk | none
rotation_policy: string
collector_id: string
collector_version: string
```

### LogRecord

```yaml
record_id: string
stream_id: string
ingest_run_id: string
ts_source: string
ts_ingest: string
seq_no: number
boot_id: string
session_id: string
offset: number
prev_hash: string
hash: string
signature: string
key_id: string
level: string
category: string
message: string
fields: {}
parse_status: ok | schema_drift | parse_error | truncated
tamper_flags:
  - hash_gap
  - seq_gap
  - time_skew
  - bad_signature
  - out_of_order
```

### IngestRun

```yaml
ingest_run_id: string
collector_host: string
window_start: string
window_end: string
bytes_read: number
records_ok: number
records_error: number
gaps_detected: []
```

## Canonical boundary verbs

Execution:

- `process_start`;
- `module_load`;
- `ipc_send`.

Identity:

- `authenticate`;
- `token_issue`;
- `token_use`.

Network:

- `dns_query`;
- `connect`;
- `request`;
- `response`.

Storage:

- `mount`;
- `file_read`;
- `file_write`.

Content/UI:

- `cookie_set`;
- `cookie_send`;
- `document_open`;
- `font_load`;
- `canvas_render`;
- `sensor_access`.

Lifecycle:

- `attach`;
- `app_install`;
- `extension_install`;
- `config_change`.

## 23-topic canon mapping

The boundary model carries the 23-topic canon as tags on ports and secondarily on boundary events. Topic 23 controls contracts, ownership, policy, ATT&CK mapping, risk, and chain-of-custody.

Boundary-first topic use:

- tag `Port` primarily;
- tag `BoundaryEvent` secondarily;
- attach `Contract` to Topic 23 and whichever domain it governs;
- attach evidence and findings to the specific boundary event, not to an unbounded global narrative.

## Starter expectations

1. `extension_install` implies `module_load` on the execution port within 120 seconds.
2. `token_issue` implies API `request` on a network port within 60 seconds for the same session.
3. `device_attach` for USB implies executable `file_write` check within 5 minutes.
4. New service domain implies prior `dns_query` within 10 seconds.
5. Security-downscope `config_change` implies audit `LogRecord` within 5 seconds.
6. Successful `authenticate` implies session-start record within 2 seconds.
7. HSTS state change implies browser-state write within 10 seconds.
8. New driver load implies valid signature and provenance immediately.

Each unmet expectation yields:

- `Finding(kind=MissingRecord | Gap | BoundaryViolation | SignatureInvalid)`;
- `Evidence(role=absent_expected)` when expected evidence is missing;
- link back to `Port`, `Contract`, and `BoundaryEvent`.

## Worked example

Flow:

1. `BoundaryEvent(APP.ContentPort, extension_install)`
2. `BoundaryEvent(APP.ContentPort, cookie_set, artifact=Cookie#C1)`
3. `BoundaryEvent(APP.IdentityPort, token_issue, artifact=Token#T1)`
4. `BoundaryEvent(APP.NetworkPort, connect, outside=NetEndpoint#E1)`
5. `BoundaryEvent(APP.NetworkPort, request, outside=Service.API)`

Unmet expectation:

- expected renderer `module_load` is absent;
- unified log has a sequence gap.

Result:

- `Finding(MissingRecord)` for absent `module_load`;
- `Evidence(role=absent_expected)` with a bounded time window;
- `Finding(Gap)` with `tamper_flags=[seq_gap]` on the surrounding log records.

## SCOPE-D integration

Future schemas:

- `component.schema.json`;
- `port.schema.json`;
- `contract.schema.json`;
- `boundary-event.schema.json`;
- `evidence.schema.json`;
- `expectation.schema.json`;
- `finding.schema.json`;
- `artifact.schema.json`;
- `log-integrity.schema.json`.

Future examples:

- browser extension boundary event;
- font-load boundary event;
- token-issue boundary event;
- missing-record negative evidence;
- log tamper finding;
- contract boundary violation.

## Safety boundary

The boundary hypergraph is an evidence model. It does not authorize scanning, exploitation, mutation, or enforcement. Any write or enforcement action still requires SCOPE-D control gates and explicit policy/operator approval.

## Completion definition

This alignment is complete when SCOPE-D can validate boundary events, expectations, negative evidence, tamper findings, and artifacts as first-class control-loop evidence, and when dashboard panels can render cross-boundary behavior by port and contract.
