# Devine Intelligence Wargames — Tree-sitter to LSA/LSI/LDA Bridge

Status: v0.1 canonical capture  
Canonical program: Devine Intelligence Wargames  
Owner plane: grammar, evidence dialects, ontology inputs, semantic enrichment, and learning-loop infrastructure  
Implementation state: prose capture only; grammar/schema/example/CI backlog

## Purpose

This document defines the bridge from Tree-sitter grammars to Wargames LSA/LSI/LDA learning surfaces.

The goal is to turn Wargames evidence, policy, proof, telemetry, and ontology dialects into parseable, typed structures that can feed:

- Boundary Cyber Hypergraph objects;
- Ontogenesis ontology modules and SHACL gates;
- SynapseIQ enrichment and reasoning;
- LSA/LSI/LDA topic learning;
- MeshRush graph views;
- HellGraph proof/replay streams;
- OFIF/Orion field-intelligence outputs;
- dashboards and commander views.

Tree-sitter is used here as a parsing and structure-extraction layer, not as an execution engine.

## Why Tree-sitter belongs in Wargames

Wargames has many semi-structured dialects:

- Event-IR;
- BoundaryEvent records;
- ProofArtifact records;
- policy packs;
- Rego snippets;
- detector rules;
- LSA/LSI map files;
- agent manifests;
- Memphis governance packs;
- dynamic engagement authorizations;
- OFIF field-intelligence envelopes;
- Ontogenesis JSON-LD and SHACL artifacts;
- public-index exposure query records;
- font/rendering profile records.

Without grammars, these remain loosely structured documents. With grammars, they become typed parse trees that can support validation, extraction, indexing, learning, ontology alignment, and evidence replay.

## Grammar design principles

### 1. Intuitive structure

Each grammar should produce concrete syntax trees whose nodes correspond to recognizable Wargames constructs.

Good node families:

- `source_file`;
- `document`;
- `section`;
- `declaration`;
- `definition`;
- `statement`;
- `expression`;
- `identifier`;
- `field`;
- `value`;
- `block`;
- `policy_rule`;
- `proof_ref`;
- `evidence_ref`;
- `topic_ref`;
- `phase_ref`;
- `surface_ref`;
- `agent_ref`;
- `authorization_ref`.

Bad pattern:

- deeply mirroring a language spec when the parse tree becomes unreadable;
- producing long indirection chains that hide the operational construct;
- naming nodes after internal parser convenience instead of domain meaning.

### 2. LR(1)-friendly skeleton

Tree-sitter handles general context-free grammars through GLR machinery, but Wargames grammars should stay close to LR(1) where possible.

Practical rule:

- start breadth-first;
- define top-level groups first;
- add detail only after parse tests exist;
- prefer explicit precedence and associativity over ambiguous sprawl;
- declare conflicts intentionally when ambiguity is meaningful.

### 3. Breadth-first rule skeleton

Every Wargames grammar should begin with an obvious skeleton.

Example conceptual layout:

```javascript
module.exports = grammar({
  name: 'wargames_artifact',

  word: $ => $.identifier,

  rules: {
    source_file: $ => repeat($._definition),

    _definition: $ => choice(
      $.event_definition,
      $.proof_definition,
      $.policy_definition,
      $.topic_definition,
      $.authorization_definition
    ),

    event_definition: $ => seq('event', field('name', $.identifier), $.block),
    proof_definition: $ => seq('proof', field('name', $.identifier), $.block),
    policy_definition: $ => seq('policy', field('name', $.identifier), $.block),
    topic_definition: $ => seq('topic', field('id', $.topic_ref), $.block),
    authorization_definition: $ => seq('authorization', field('id', $.identifier), $.block),

    block: $ => seq('{', repeat($._statement), '}'),

    _statement: $ => choice(
      $.field_assignment,
      $.proof_ref,
      $.evidence_ref,
      $.safety_boundary_ref
    ),

    field_assignment: $ => seq(field('key', $.identifier), ':', field('value', $._value)),
    _value: $ => choice($.identifier, $.string, $.number, $.boolean),

    topic_ref: $ => /T[0-9]+/,
    identifier: $ => /[A-Za-z_][A-Za-z0-9_-]*/,
    string: $ => /"[^"]*"/,
    number: $ => /[0-9]+(\.[0-9]+)?/,
    boolean: $ => choice('true', 'false')
  }
});
```

This is illustrative only. Actual grammars must be split by dialect.

## Wargames grammar families

### 1. Event and Boundary Grammar

Purpose:

- parse Event-IR;
- parse BoundaryEvent records;
- parse Evidence, Finding, Artifact, Expectation records;
- expose typed nodes for Ontogenesis and SynapseIQ.

Key nodes:

- `boundary_event`;
- `component_ref`;
- `port_ref`;
- `contract_ref`;
- `evidence_ref`;
- `finding_ref`;
- `artifact_ref`;
- `negative_evidence`;
- `tamper_flag`;
- `topic_ref`;
- `mode_ref`.

LSA output:

- surface tokens;
- action verbs;
- evidence role;
- finding kind;
- tamper flags;
- completeness score;
- topic refs.

LSI anchors:

- Topic 9 for header events;
- Topic 19 for ontology types;
- Topic 20 for graph/topology;
- Topic 23 for DevEx and workspace artifacts.

### 2. Proof and Promotion Grammar

Purpose:

- parse ProofArtifact shapes;
- parse promotion packs;
- parse Memphis Rite governance receipts;
- parse BridgeMode gates;
- parse dynamic engagement authorizations.

Key nodes:

- `proof_artifact`;
- `promotion_pack`;
- `bridge_gate`;
- `limit_receipt`;
- `rollback_proof`;
- `engagement_authorization`;
- `approval_status`;
- `approver`;
- `michael_signoff_required`.

LSA output:

- proof type;
- authority tier;
- approval status;
- redaction state;
- quorum state;
- rollback posture;
- bridge eligibility.

LSI anchors:

- Topic 14 FROST promotion;
- Topic 15 CI drift;
- Topic 18 provenance;
- Topic 23 DevEx.

### 3. Policy and Control Grammar

Purpose:

- parse policy packs;
- parse Rego-like fragments where used;
- parse WAF / CSP / header policy configs;
- parse egress and VI configs;
- parse dynamic engagement policy objects.

Key nodes:

- `policy_rule`;
- `allow_clause`;
- `deny_clause`;
- `scope_clause`;
- `rollback_clause`;
- `header_rule`;
- `dns_rule`;
- `engagement_level`;
- `approval_requirement`.

LSA output:

- action kind;
- boundary scope;
- allow/deny state;
- rollback ref;
- authorization requirement;
- safety class.

LSI anchors:

- Topic 11 info fields;
- Topic 12 egress economy;
- Topic 15 CI drift;
- Topic 19 policy type.

### 4. Topic and Learning Grammar

Purpose:

- parse Wargames topic maps;
- parse LSA/LSI maps;
- parse LDA expansion candidates;
- parse learning corpora manifests;
- parse grammar test manifests.

Key nodes:

- `topic_definition`;
- `lsa_dimension`;
- `lsi_prime_anchor`;
- `cross_topic_edge`;
- `learning_corpus`;
- `redaction_state`;
- `reproducibility_check`.

LSA output:

- top terms;
- dimension refs;
- topic IDs;
- cross-topic edge features;
- learning mode metadata.

LSI anchors:

- all p2..p31 anchors;
- all 23 topics.

### 5. OFIF / SynapseIQ Grammar

Purpose:

- parse OFIF field-intelligence envelopes;
- parse SynapseIQ enrichment records;
- parse client access envelopes;
- parse assurance packets;
- parse activation records.

Key nodes:

- `field_observation`;
- `fused_finding`;
- `assurance_packet`;
- `field_task`;
- `enrichment_record`;
- `quality_report`;
- `activation_target`;
- `client_access_tier`;
- `disclosure_class`.

LSA output:

- client impact;
- recommendation type;
- confidence;
- quality status;
- activation target;
- disclosure class.

LSI anchors:

- Topic 18 publishing;
- Topic 19 ontology;
- Topic 20 graph reasoning;
- Topic 23 DevEx.

## Lexical discipline

Tree-sitter grammars should use word tokens for identifiers so keywords do not split incorrectly.

Required keyword discipline:

- keywords like `DEFENSE`, `LEARNING`, `BridgeMode`, `LIMIT`, `ALIGN`, `ACCUM`, `E0`, `E1`, `E2`, `E3`, `E4`, `E5`, `E6` should not be recognized inside longer identifiers;
- identifiers should remain stable under parse and export;
- lexical precedence must be separated from parse precedence;
- reserved words must be documented per grammar.

## Precedence and associativity

Policy expressions, query expressions, and rule expressions may require precedence handling.

Guidelines:

- use explicit precedence for unary, binary, and logical forms;
- use left associativity for repeated same-level binary operators where appropriate;
- avoid deeply nested spec-derived operator chains when a flat readable tree with precedence is better;
- declare intentional conflicts explicitly.

## Fields and hidden rules

Use Tree-sitter `field()` names for high-value children:

- `name`;
- `id`;
- `mode`;
- `phase`;
- `surface`;
- `agent`;
- `evidence`;
- `proof`;
- `authorization`;
- `rollback`;
- `redaction`;
- `topic`.

Use hidden rules for wrappers that do not add semantic value, such as `_expression`, `_value`, `_definition`, or `_statement`.

## Corpus tests

Every grammar should include corpus tests.

Minimum tests:

- valid BoundaryEvent;
- negative evidence record;
- promotion pack;
- dynamic engagement authorization;
- Wargames DEFENSE run;
- Wargames LEARNING run;
- OFIF field observation;
- SynapseIQ enrichment record;
- LSA/LSI topic map;
- invalid authorization example;
- invalid BridgeMode release example;
- invalid raw identity disclosure example.

## Parse-to-LSA pipeline

```text
source artifact
  -> Tree-sitter parse tree
  -> typed node extraction
  -> normalized token stream
  -> structured feature table
  -> TF-IDF / embeddings
  -> LSA global rank-23
  -> per-topic LSA-10
  -> LSI p2..p31 anchors
  -> optional LDA expansion after coverage and redaction checks
```

## Parse-to-Ontogenesis pipeline

```text
source artifact
  -> Tree-sitter parse tree
  -> typed node extraction
  -> JSON-LD export envelope
  -> Ontogenesis SHACL validation
  -> ontology module or instance graph
  -> SynapseIQ enrichment
  -> OFIF or dashboard activation
```

## Parse-to-Boundary pipeline

```text
source telemetry or proof artifact
  -> Tree-sitter parse tree
  -> Event-IR / BoundaryEvent extraction
  -> Evidence / Finding / Artifact linkage
  -> negative evidence detection where expectations fail
  -> proof refs
  -> MeshRush graph view and HellGraph proof stream
```

## Defensive safety rules

Tree-sitter grammars may parse security-relevant syntax. They must not become execution engines.

Required boundaries:

- no exploit execution;
- no credential collection;
- no destructive automation;
- no unapproved probing;
- no automatic policy mutation from parse output alone;
- dynamic engagement above E3 requires approval path;
- E4/E5/E6 requires Michael Heller signoff until delegated policy exists.

## Implementation backlog

### Repos and paths

Potential owning paths:

- `SocioProphet/SCOPE-D`: defensive schemas, examples, validation, Wargames capture.
- `SocioProphet/ontogenesis`: ontology modules, JSON-LD, SHACL gates.
- `SocioProphet/synapseiq`: grammars, enrichment records, quality and reasoning surfaces.
- `SocioProphet/meshrush`: graph-view consumption.
- `SocioProphet/hellgraph`: proof stream and replay consumption.

### Future grammar packages

Suggested grammar packages:

- `tree-sitter-wargames-event`;
- `tree-sitter-wargames-proof`;
- `tree-sitter-wargames-policy`;
- `tree-sitter-wargames-topic`;
- `tree-sitter-wargames-ofif`.

### Future schema links

- `jsonld-export-envelope.schema.json`;
- `synapseiq-wargames-enrichment-record.schema.json`;
- `boundary-event.schema.json`;
- `wargames-lsa-lsi-map.schema.json`;
- `engagement-authorization.schema.json`.

## Completion definition

This bridge is implementation-backed only when at least one grammar exists with corpus tests, typed extraction, schema-backed outputs, and CI validation. Until then, this document is canonical prose capture, not parser implementation.
