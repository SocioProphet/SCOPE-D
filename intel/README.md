# SCOPE-D Intelligence Fabric

Status: v0.1 fixture-backed implementation slice.

This lane turns partner intelligence into normalized SCOPE-D evidence without allowing active scanning, payload delivery, credential access, mutation, or live partner lookups in this first slice.

## Purpose

The intelligence fabric gives SCOPE-D a vendor-grade enrichment boundary:

```text
IndicatorRecord
  -> provider-specific fixture/live-readonly adapter
  -> IntelligenceReceipt
  -> IntelligenceObservation
  -> CyberGraphEdge
  -> operator case / graph export / assurance report
```

The first implementation is deliberately fixture-only. It defines the normalized contracts and executable path before live API credentials are introduced.

## Supported provider lanes

The provider registry currently models the following partner/data lanes:

- VirusTotal-style artifact reputation
- GreyNoise-style internet-noise classification
- urlscan-style URL analysis
- CISA KEV / EPSS / NVD vulnerability prioritization
- OSV / GitHub Advisory package vulnerability context
- Mandiant / Recorded Future adversary context
- Shodan / Censys attack-surface context

## Commands

```bash
npm run intel:enrich -- examples/scope-d/intelligence-indicators.example.json
npm run intel:graph -- runs/intelligence-enrichment.json
npm run test:intelligence-fabric
```

## Safety posture

- fixture mode only in this PR
- no network access
- no live partner API calls
- no active scan execution
- no credential collection
- no payload delivery
- no infrastructure mutation
- every observation is tied to a receipt and graph edge

## Competitive role

This is the first step toward SCOPE-D becoming a vendor-neutral intelligence and assurance fabric. Instead of trying to out-telemetry Microsoft, CrowdStrike, Palo Alto, Wiz, Mandiant, or Recorded Future, SCOPE-D normalizes their signals into evidence receipts, confidence-scored observations, graph edges, operator cases, detections, and client assurance reports.
