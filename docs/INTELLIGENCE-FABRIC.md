# SCOPE-D Intelligence Fabric v0.1

Status: first executable fixture-backed slice

## Purpose

The Intelligence Fabric turns partner intelligence, local evidence, and SCOPE-D assessment artifacts into normalized receipts, observations, and cyber graph edges.

This is the first step toward a vendor-neutral cyber intelligence and assurance layer that can stand beside commercial security platforms without pretending to own their telemetry.

## v0.1 provider lanes

The first executable slice models these partner/data lanes:

| Provider lane | Primary use |
|---|---|
| VirusTotal | artifact, URL, domain, IP reputation and relationship context |
| GreyNoise | internet background-noise and opportunistic scanner context |
| urlscan | URL, redirect, page artifact, and phishing context |
| CISA KEV | known exploited vulnerability prioritization |
| EPSS | exploit probability scoring lane |
| NVD | vulnerability metadata lane |
| OSV | open-source package vulnerability lane |
| GitHub Advisory | repository and dependency advisory lane |
| Mandiant / Google Threat Intelligence | campaign, actor, malware, and incident-response context |
| Recorded Future | external intelligence fusion and adversary context |
| Shodan | external attack-surface context |
| Censys | certificate, host, and internet-exposure context |

v0.1 is fixture-only. It performs no live API calls, no scanning, no credential access, no payload delivery, and no mutation.

## Executable path

```text
Intelligence request fixture
  -> run-intelligence-enrichment.js
  -> IntelligenceEnrichment
  -> IntelligenceReceipt[]
  -> IntelligenceObservation[]
  -> CyberGraphEdge[]
```

The script is:

```bash
npm run intelligence:enrich -- examples/scope-d/intelligence-indicators.example.json
npm run test:intelligence
```

## Downstream SocioProphet alignment

### SynapseIQ

SynapseIQ consumes enriched observations as synthesis material. SCOPE-D should send only receipt-backed observations and graph edges. SynapseIQ must not become an ungrounded summarizer; every claim should resolve to an `IntelligenceReceipt`, `ProofArtifact`, `RunReceipt`, or source assessment artifact.

Initial handoff object:

```text
IntelligenceObservation
  -> SynapseIQEnrichmentInput
  -> grounded narrative, hypothesis, confidence, countermeasure candidate
```

### Sherlock Search

Sherlock Search should index normalized indicators, receipts, observations, graph edges, playbooks, and case bundles. Search results should rank by evidence hash, provider confidence, recency, asset criticality, and graph reachability.

Initial handoff object:

```text
IntelligenceEnrichment
  -> SherlockDocument
  -> searchable evidence packet
```

### Orion Field Intelligence

Orion Field Intelligence should consume external context around infrastructure, geography, organizations, threat actor operating areas, exposed assets, internet routes, cloud regions, and temporal campaign context.

Initial handoff object:

```text
CyberGraphEdge
  -> OrionFieldSignal
  -> asset/context/campaign overlay
```

### Noetica

Noetica should become the local operator workbench for SCOPE-D. It should display evidence timelines, graph neighborhoods, workorders, operator cases, playbooks, live-readonly authorization state, and client assurance reports.

Initial handoff object:

```text
OperatorCaseBundle + IntelligenceEnrichment
  -> NoeticaCaseWorkspace
```

## Product meaning

This slice moves SCOPE-D from validator-only toward a partner-aware intelligence layer:

1. normalize partner intelligence;
2. preserve source receipts;
3. attach confidence and terms class;
4. produce graph edges;
5. feed SynapseIQ, Sherlock Search, Orion Field Intelligence, Noetica, HellGraph, and Ontogenesis without losing provenance.

## Non-claims

This slice does not:

- call VirusTotal, GreyNoise, urlscan, Mandiant, Recorded Future, Shodan, Censys, NVD, EPSS, OSV, or GitHub Advisory APIs;
- perform live scanning;
- perform malware analysis;
- perform C2 simulation;
- execute payloads;
- mutate infrastructure;
- write production policy;
- deliver client-facing intelligence without operator approval.

## Next slices

1. Add provider-specific request and response schemas.
2. Add a provider policy contract for live-readonly enrichment.
3. Add cache and quota receipts.
4. Add HellGraph/Ontogenesis export from `graphEdges`.
5. Add Sherlock Search document export.
6. Add SynapseIQ enrichment-input export.
7. Add Noetica case workspace export.
8. Add Orion field signal export.
