# SCOPE-D Cyber Graph Export v0.1

Status: executable export slice

## Purpose

Cyber Graph Export v0.1 turns SCOPE-D intelligence and detection artifacts into a graph-centered runtime handoff.

The export is designed to bridge SCOPE-D into:

- HellGraph proof/event streams;
- Ontogenesis RDF/Turtle exports;
- Sherlock Search graph documents;
- SynapseIQ graph packets;
- Noetica graph workspaces.

## Input chain

```text
IntelligenceEnrichment
  -> DetectionCandidateExport
  -> CyberGraphExport
```

Both inputs must have `executionPerformed=false`.

## Output artifacts

The exporter writes:

- `cyber-graph-export.json`
- `hellgraph-stream.jsonl`
- `ontogenesis-cyber-graph.ttl`
- `sherlock-graph-documents.json`
- `synapseiq-graph-packet.json`
- `noetica-graph-workspace.json`

## Graph node classes

- indicator
- provider
- observation
- evidence receipt
- detection candidate
- rule family
- ATT&CK technique
- deployment target
- agent workflow
- edge bastion

## Graph edge classes

- enriched_by
- produced_receipt
- produced_observation
- grounded_in
- generated_candidate
- maps_to_attack
- uses_rule_family
- targets_deployment
- reviewed_by_workflow
- eligible_for_edge_bastion

## Safety boundary

This export does not execute detections, call partner APIs, deploy controls, mutate infrastructure, or run model workflows. It is a graph handoff and evidence-routing layer only.

## Command

```bash
npm run graph:export -- --enrichment <intelligence-enrichment.json> --detections <detection-candidates.json> --out-dir <graph-dir>
npm run test:graph
```

## Next slices

1. Add HellGraph replay validation.
2. Add SHACL validation for Ontogenesis graph terms.
3. Add Sherlock vector-ready chunk metadata.
4. Add SynapseIQ contradiction and confidence propagation packets.
5. Add Noetica timeline and graph-neighborhood workspace sections.
6. Add CloudShell Fog delivery-envelope graph nodes.
7. Add PolicyFabric approval edges.
