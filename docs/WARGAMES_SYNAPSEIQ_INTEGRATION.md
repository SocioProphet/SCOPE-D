# Wargames Integration: SynapseIQ

Status: v0.1 reconciliation baseline  
Owner plane: SCOPE-D / Devine Intelligence Wargames semantic enrichment and intelligence activation  
Related repo: `SocioProphet/synapseiq`  
Boundary: enrichment, normalization, ontology alignment, quality validation, reasoning, search/QA, and downstream activation

## Purpose

This document adds SynapseIQ as a first-class integration target for Devine Intelligence Wargames.

SynapseIQ is the semantic enrichment and intelligence fabric for structured, semi-structured, and event-stream data. In the Wargames architecture, it should enrich, normalize, validate, reason over, and activate Wargames evidence after SCOPE-D has produced governed defensive artifacts.

SCOPE-D Wargames remains the defensive validation and evidence-production layer. SynapseIQ is the enrichment and intelligence-fabric layer.

## Grounded repo position

`SocioProphet/synapseiq` defines SynapseIQ as a vendor-agnostic semantic enrichment and intelligence fabric for structured, semi-structured, and event-stream data.

Its declared capability surface includes:

- ingestion;
- normalization;
- semantic enrichment;
- ontology alignment;
- glossary and business-term mapping;
- quality validation;
- reasoning and inference;
- search and question answering;
- downstream activation across analytics, martech, security, and operational systems.

It is designed around strong contracts, UDM-aligned canonical models, ontology-aware reasoning, stream/batch parity, explainability, provenance, and replayability.

## Correct role in the Wargames stack

```text
SCOPE-D Wargames
  defensive validation, exercises, findings, proofs, safety gates
        |
        | validated evidence and proof-bearing event streams
        v
Boundary Cyber Hypergraph
  Component, Port, Contract, BoundaryEvent, Evidence, Finding, Artifact
        |
        | semantic validation and ATT&CK understanding
        v
Ontogenesis
  RDF/OWL/JSON-LD, SHACL, ontology lifecycle governance
        |
        | enrichment-ready facts and semantic contracts
        v
SynapseIQ
  ingestion, normalization, enrichment, quality, reasoning, search/QA, activation
        |
        | client and operations outputs
        v
OFIF / Orion, SocioSphere, analytics, security operations, reporting
```

SynapseIQ does not replace SCOPE-D, Ontogenesis, MeshRush, HellGraph, Regis, or OFIF.

- SCOPE-D owns defensive validation and safety gates.
- Boundary Hypergraph owns evidence structure.
- Ontogenesis owns ontology governance and semantic validation.
- SynapseIQ owns enrichment, normalization, reasoning, search/QA, quality validation, and activation.
- OFIF/Orion owns client-facing field-intelligence delivery.

## Wargames data SynapseIQ should consume

SynapseIQ should consume governed, validated Wargames objects such as:

- BoundaryEvents;
- Evidence records;
- Findings;
- ProofArtifact digests;
- WargamesRun summaries;
- LSA/LSI topic maps;
- ATT&CK coverage claims;
- Ontogenesis JSON-LD exports;
- OFIF-ready summaries;
- dynamic engagement summaries;
- promotion/bridge receipts;
- redacted learning corpora.

It should not ingest raw unsafe internal data by default.

## SynapseIQ enrichment responsibilities

### 1. Ingestion and normalization

Normalize Wargames events and artifacts into canonical enrichment records.

Examples:

- normalize `BoundaryEvent` variants;
- normalize agent proof summaries;
- normalize ATT&CK coverage claims;
- normalize OFIF field-observation inputs;
- normalize Topic p2..p31 anchors.

### 2. Semantic enrichment

Attach semantic context from Ontogenesis and Wargames maps.

Examples:

- attach tactic/technique coverage labels;
- attach topic refs;
- attach glossary/business terms;
- attach surface/phase/agent metadata;
- attach confidence and provenance.

### 3. Quality validation

Validate completeness, consistency, and readiness.

Examples:

- missing proof refs;
- missing redaction state;
- invalid topic refs;
- stale ontology version;
- unapproved dynamic engagement summary;
- incomplete OFIF client envelope.

### 4. Reasoning and inference

Provide safe, defensive reasoning over enriched records.

Examples:

- infer likely coverage gaps;
- identify contradictory findings;
- reason over repeated boundary events;
- summarize control posture;
- explain why a finding matters;
- generate operator questions for missing evidence.

### 5. Search and QA

Expose controlled search and question-answering over governed Wargames records.

Examples:

- "Which topics have unresolved high-confidence findings?"
- "Which controls cover this ATT&CK technique?"
- "Which proof packs are ready for OFIF release?"
- "Which dynamic engagements require Michael approval?"
- "Which BoundaryEvents have negative evidence?"

### 6. Downstream activation

Activate enriched outputs into appropriate systems.

Examples:

- OFIF / Orion field intelligence;
- SocioSphere commander views;
- dashboards;
- warehouse marts;
- audit reports;
- customer assurance packets;
- internal security operations workflows.

## SynapseIQ canonical envelope for Wargames

Future schemas should define a Wargames enrichment envelope.

```yaml
kind: WargamesEnrichmentRecord
id: synapseiq-wargames:<id>
sourceSystem: scope-d
sourceRunRef: scope-d-run:<id>
objectType: BoundaryEvent | Evidence | Finding | ProofArtifact | CoverageClaim | OFIFSummary | EngagementSummary
mode: DEFENSE | LEARNING
surfaceRefs: []
phaseRefs: []
topicRefs: []
lsiAnchors: []
ontologyRefs: []
attackRefs: []
proofRefs: []
redactionState: raw | redacted | synthetic | withheld
disclosureClass: internal | client | auditor | public_redacted
quality:
  completeness: number
  consistency: number
  confidence: number
  validationState: valid | invalid | needs_review
provenance:
  createdAt: string
  sourceHash: string
  ontologyVersion: string
  schemaVersion: string
activationTargets: []
```

## Relation to OFIF / Orion

OFIF is the client-facing field-intelligence surface. SynapseIQ enriches and prepares records before OFIF publication.

SynapseIQ should provide OFIF-ready records with:

- normalized summaries;
- client-safe terminology;
- ontology-backed explanations;
- confidence scores;
- redaction state;
- disclosure class;
- proof refs;
- source run refs;
- authorization refs where applicable.

OFIF should not need to parse raw SCOPE-D internals.

## Relation to Ontogenesis

Ontogenesis governs ontology modules and SHACL validation. SynapseIQ consumes those semantic contracts.

SynapseIQ should record:

- ontology module version;
- SHACL validation status;
- ATT&CK coverage semantics;
- glossary mappings;
- UDM-aligned canonical fields.

If Ontogenesis validation fails, SynapseIQ activation should be blocked or marked `needs_review`.

## Relation to MeshRush and HellGraph

SynapseIQ should be able to enrich graph and replay outputs.

MeshRush contributes:

- graph-view summaries;
- local structure summaries;
- diffusion/crystallization outputs.

HellGraph contributes:

- proof-stream digests;
- replay summaries;
- checkpoint refs;
- incident-link summaries.

SynapseIQ enriches these for search, QA, analytics, and OFIF activation.

## Relation to dynamic engagement

SynapseIQ must preserve engagement policy state.

Dynamic engagement records should retain:

- engagement level;
- trigger refs;
- authorization refs;
- Michael approval status where required;
- evidence refs;
- proof receipts;
- redaction state;
- disclosure class.

SynapseIQ must not activate E4/E5/E6 outputs to clients unless authorization state is valid.

## Required SCOPE-D follow-ups

Docs:

- update `WARGAMES_CAPTURE_LEDGER.md` to include SynapseIQ as first-class enrichment/activation layer;
- update `WARGAMES_OFIF_ORION_INTEGRATION.md` to state that OFIF consumes SynapseIQ-prepared records;
- update `WARGAMES_ONTOGENESIS_ATTACK_INTEGRATION.md` to define Ontogenesis -> SynapseIQ semantic handoff.

Schemas:

- `synapseiq-wargames-enrichment-record.schema.json`;
- `synapseiq-wargames-quality-report.schema.json`;
- `synapseiq-wargames-activation-envelope.schema.json`.

Examples:

- enriched BoundaryEvent;
- enriched Finding;
- enriched ATT&CK coverage claim;
- OFIF-ready enriched field observation;
- dynamic engagement summary blocked for missing approval;
- redacted LEARNING-mode corpus record.

CI checks:

- SynapseIQ activation envelope requires redaction state;
- activation to OFIF requires disclosure class;
- E4/E5/E6 activation requires valid authorization;
- ontology validation failure blocks or marks `needs_review`;
- proof refs required for assurance outputs.

## Completion definition

This integration is complete when SCOPE-D can emit SynapseIQ-ready enrichment records, SynapseIQ can normalize and validate them under contract, Ontogenesis semantic status is preserved, and OFIF can consume SynapseIQ-prepared client-facing intelligence without touching raw SCOPE-D internals.
