# Wargames Integration: Ontogenesis and ATT&CK Understanding

Status: v0.1 reconciliation baseline  
Owner plane: SCOPE-D / Devine Intelligence Wargames semantic reasoning architecture  
Related repo: `SocioProphet/ontogenesis`  
Boundary: defensive ontology, ATT&CK understanding, reasoning, validation, and governance

## Purpose

This document adds Ontogenesis as the ontology and reasoning layer for Devine Intelligence Wargames.

SCOPE-D Wargames produces defensive evidence, boundary events, findings, proof artifacts, exercises, and learning corpora. Ontogenesis provides the governed ontology engineering framework that should define, validate, link, and promote the semantic model for those artifacts.

Ontogenesis is not a runtime detector and not an execution authority. It is the semantic governance plane for RDF/OWL/JSON-LD assets, SHACL constraints, module registries, ontology promotion, and ATT&CK understanding.

## Grounded repo position

Ontogenesis is an auditable, policy-gated ontology engineering framework for RDF/OWL/JSON-LD assets across the SocioProphet stack. It supports ontology creation, linking, validation, and lifecycle governance across layered semantic modules. Its repository contains layered ontology modules, domain ontologies, platform modules, SHACL constraints, examples, a registry, validation scripts, ledger/signing utilities, and SBOM generation.

Ontogenesis has a mature validation discipline:

- RDF parse validation;
- SHACL gates;
- JSON-LD roundtrip checks;
- deterministic dist build;
- ledger build and verification;
- SPDX SBOM generation;
- release-time signatures and validation.

SCOPE-D should reuse that discipline instead of creating a parallel ontology governance stack.

## Correct role in the Wargames stack

```text
SCOPE-D Wargames
  defensive exercises, evidence, findings, proofs, gates
        |
        | emits ontology-ready event/finding/control facts
        v
Boundary Cyber Hypergraph
  Component, Port, Contract, BoundaryEvent, Evidence, Finding, Artifact
        |
        | semantic projection
        v
Ontogenesis
  RDF/OWL/JSON-LD modules, SHACL gates, ATT&CK semantics, lifecycle governance
        |
        | graph views and validated semantic context
        v
MeshRush / HellGraph / SocioSphere
  traversal, replay, persistence, visualization, and operations
```

## ATT&CK understanding

Ontogenesis should provide the semantic model for ATT&CK-style understanding, but Wargames must remain defensive.

Allowed Ontogenesis-backed ATT&CK uses:

- technique taxonomy;
- tactic/technique relationships;
- defensive detection coverage;
- expected telemetry mapping;
- control coverage mapping;
- evidence-to-technique explanation;
- exercise-to-technique coverage;
- gap analysis;
- countermeasure mapping;
- training corpus labeling;
- dashboard explanations.

Disallowed uses:

- executable offensive procedures;
- exploit implementation;
- credential theft workflows;
- stealth/evasion logic;
- destructive automation;
- unauthorized access plans.

ATT&CK in this system is an ontology of defensive understanding, not an action cookbook.

## Core ontology modules to add or align

### 1. Wargames core module

Concepts:

- `WargamesRun`;
- `WargamesMode`;
- `WargamesTopic`;
- `Phase`;
- `Surface`;
- `AgentRole`;
- `ProofArtifact`;
- `SafetyBoundary`;
- `PromotionGate`;
- `BridgeBoundary`.

### 2. Boundary evidence module

Concepts:

- `Component`;
- `Port`;
- `Contract`;
- `BoundaryEvent`;
- `Evidence`;
- `Expectation`;
- `Finding`;
- `Artifact`;
- `LogStream`;
- `LogRecord`;
- `IngestRun`;
- `NegativeEvidence`.

### 3. ATT&CK understanding module

Concepts:

- `Tactic`;
- `Technique`;
- `SubTechnique`;
- `ProcedurePattern`;
- `DetectionMethod`;
- `ExpectedTelemetry`;
- `ControlCoverage`;
- `ExerciseCoverage`;
- `ObservedEvidence`;
- `CoverageGap`;
- `CountermeasureRule`.

### 4. Mode and learning module

Concepts:

- `DefenseModeRun`;
- `LearningModeRun`;
- `LearningCorpus`;
- `LSADimension`;
- `LSIPrimeAnchor`;
- `LDATopicExpansion`;
- `ReproducibilityCheck`;
- `GrammarCoverage`;
- `SHACLValidationResult`.

### 5. Disclosure and identity governance module

Concepts:

- `IdentityContext`;
- `DisclosureBoundary`;
- `DefenseCorrelationAuthority`;
- `RedactionState`;
- `BridgeProofLeaf`.

This module must encode the correction that identity-prime constraints apply to disclosure and learning reuse, not to authorized defensive correlation.

## SCOPE-D to Ontogenesis export contract

SCOPE-D should emit JSON-LD-ready objects from validated Wargames examples.

Minimum export fields:

```yaml
@context: string
@type: BoundaryEvent | Finding | Evidence | WargamesRun | ProofArtifact
id: string
topicRefs: []
mode: DEFENSE | LEARNING
surfaceRefs: []
phaseRefs: []
agentRefs: []
proofRefs: []
safetyBoundaryRef: string
attackRefs: []
controlRefs: []
redactionState: raw | redacted | synthetic | withheld
```

## SHACL gates

Ontogenesis should enforce semantic gates such as:

- every `BoundaryEvent` has a `Port` and `Contract`;
- every `Finding` links to evidence;
- every `NegativeEvidence` has an expectation and time window;
- every ATT&CK technique mapping has an evidence or coverage rationale;
- every `LEARNING` corpus has redaction state and provenance;
- every `BridgeProofLeaf` excludes raw sensitive data unless explicitly authorized;
- every `PromotionGate` has proof refs and quorum refs;
- every public/reporting artifact has disclosure classification.

## ATT&CK coverage model

Wargames should represent ATT&CK understanding as coverage, not execution.

A coverage object should answer:

- what tactic or technique is represented;
- what telemetry is expected;
- what boundary events can support it;
- what detections or controls cover it;
- what exercise proves coverage;
- what evidence supports the claim;
- what gaps remain;
- what confidence applies.

Example conceptual shape:

```yaml
kind: AttackCoverageClaim
id: attack-coverage:<id>
techniqueRef: attack:Txxxx
expectedTelemetryRefs: []
boundaryEventRefs: []
detectionRefs: []
controlRefs: []
exerciseRefs: []
evidenceRefs: []
coverageState: covered | partial | gap | unknown
confidence: number
proofRefs: []
```

## Integration with MeshRush and HellGraph

Ontogenesis supplies validated semantic meaning. MeshRush uses graph views. HellGraph preserves proof and replay state.

- SCOPE-D emits validated evidence and coverage objects.
- Ontogenesis validates and promotes semantic modules.
- MeshRush traverses resulting typed graph views.
- HellGraph journals and replays proof/event streams.
- SocioSphere can visualize coverage, gaps, and promotion state.

## Required SCOPE-D follow-ups

Docs:

- update `WARGAMES_MESHRUSH_REGIS_HELLER_ER_INTEGRATION.md` to include Ontogenesis;
- add `WARGAMES_ATTACK_COVERAGE_MODEL.md`;
- add `WARGAMES_JSONLD_EXPORT.md`.

Schemas:

- `attack-coverage-claim.schema.json`;
- `jsonld-export-envelope.schema.json`;
- `ontology-promotion-gate.schema.json`;
- `shacl-validation-result.schema.json`.

Examples:

- ATT&CK coverage claim;
- finding-to-technique mapping;
- exercise-to-control coverage;
- negative-evidence-to-gap mapping;
- learning-corpus export with redaction state.

## Completion definition

This integration is complete when SCOPE-D can:

1. export Wargames boundary events, findings, evidence, and proof artifacts in JSON-LD-ready form;
2. map defensive observations to ATT&CK coverage claims without encoding offensive execution procedures;
3. validate semantic constraints through Ontogenesis SHACL gates;
4. promote ontology modules through Ontogenesis lifecycle governance;
5. provide MeshRush and HellGraph with semantically validated graph/evidence surfaces.
