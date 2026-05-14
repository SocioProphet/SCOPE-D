# SCOPE-D Next Runtime Backlog

GitHub Issues are currently disabled for this repository, so this file captures the immediate implementation backlog until issue tracking is enabled.

## Completed in the current contract pass

The first generic contract vertical slice is now implemented for synthetic runs:

`EngagementPolicy -> SyntheticEvent -> Event-IR -> Identity-IR -> ProofArtifact -> ControlLoopRun -> RunReceipt -> RunSummary -> Ontogenesis export`

Completed work:

- `scope-d:init` emits:
  - `engagement-policy.json`
  - `events.jsonl`
  - `event-ir.jsonl`
  - `identity-ir.json`
  - `proof-artifact.json`
  - `control-loop.json`
  - `receipt.json`
  - `report.md`
- `verify-run.js` validates EngagementPolicy, Event-IR, Identity-IR, ProofArtifact, receipt hashes, and cross-artifact references.
- `report-run.js` surfaces Event-IR, Identity-IR, and ProofArtifact counts.
- `export-ontogenesis-rdf.js` emits triples for Event-IR, Identity-IR, ProofArtifact, dynamic metric, configuration volume, and archetype metadata when present.
- `config/scope-d-lsa-map.json` is validated by `config/schemas/scope-d-lsa-map.schema.json` and `npm test`.
- `scope-d:init` now requires `--engagement-policy` and fails closed when policy is absent, unreadable, schema-invalid, or unauthorized for the requested target/surface/mode.
- Generated runs now copy the active policy into `engagement-policy.json`, link it from `control-loop.json`, hash it in the receipt, and verify it through `verify-run.js`.
- `npm test` includes engagement-policy fail-closed tests for missing policy, missing file, schema invalidity, empty authorized targets, unauthorized target, unauthorized mode, and `live_engage` without Michael approval requirement.

The first AI-infra synthetic vertical slice is also implemented:

`Synthetic MCP Tool Manifest -> AIInfraAssessment -> MCPToolRisk -> CountermeasureRule -> Event-IR -> Identity-IR -> ProofArtifact -> ControlLoopRun -> Receipt -> Ontogenesis export`

Completed AI-infra work:

- Added `fixtures/synthetic/mcp-tool-manifest.tool-poisoning.synthetic.json`.
- Added `scope-d:init-ai-infra` runner.
- Generated AI-infra runs emit:
  - `mcp-tool-manifest.synthetic.json`
  - `ai-infra-assessment.json`
  - `mcp-tool-risk.json`
  - `countermeasure-rule.json`
  - standard Event-IR / Identity-IR / ProofArtifact / ControlLoop / Receipt artifacts.
- `verify-run.js` validates AI-infra domain artifacts when present and checks their cross-references.
- `report-run.js` surfaces AIInfraAssessment, MCPToolRisk, and CountermeasureRule counts.
- `export-ontogenesis-rdf.js` emits AI-infra, MCP-risk, and countermeasure triples when present.
- `npm test` includes `test-ai-infra-slice.js`.
- CI explicitly runs the AI-infra synthetic vertical slice.

The first graph-robustness synthetic vertical slice is also implemented:

`Synthetic Trust Graph Fixture -> GraphRobustnessAssessment -> Event-IR -> Identity-IR -> graph_path_cost ProofArtifact -> ControlLoopRun -> Receipt -> Ontogenesis export`

Completed graph-robustness work:

- Added `fixtures/synthetic/graph-robustness.identity-trust.synthetic.json`.
- Added `scope-d:init-graph-robustness` runner.
- Generated graph runs emit:
  - `graph-fixture.synthetic.json`
  - `graph-robustness-assessment.json`
  - standard Event-IR / Identity-IR / ProofArtifact / ControlLoop / Receipt artifacts.
- `verify-run.js` validates GraphRobustnessAssessment when present and checks its ProofArtifact / ControlLoop references.
- `report-run.js` surfaces GraphRobustnessAssessment counts.
- `export-ontogenesis-rdf.js` emits graph-robustness triples when present.
- `npm test` includes `test-graph-robustness-slice.js`.
- CI explicitly runs the graph-robustness synthetic vertical slice.

## 1. Confirm CI and enforce branch protection

**Goal:** Make the contract-validation workflow a required gate.

**Tasks:**

- Confirm `.github/workflows/contract-validation.yml` runs green on latest `main`.
- Require the workflow in branch protection.
- Prefer PR-based changes over direct commits once branch protection is active.

**Acceptance:**

- Latest `main` commit has a passing contract-validation workflow.
- Direct contract drift cannot land without validation.

## 2. 23-topic operating map runner

**Goal:** Turn `config/scope-d-lsa-map.json` into dashboard and orchestration input.

**Tasks:**

- Add a report command that renders topic coverage and missing proof artifacts.
- Add a dashboard-ready JSON export.
- Distinguish captured-design topics from proof-producing lanes.

**Acceptance:**

- Topic map remains validated in CI.
- Output distinguishes captured design from implemented proof-producing lanes.

## 3. Runtime collector policy

**Goal:** Prepare for future collectors without violating safety doctrine.

**Tasks:**

- Define collector capability boundaries.
- Require EngagementPolicy and SafetyBoundary checks before collector execution.
- Start with read-only local synthetic collectors only.

**Acceptance:**

- No collector can contact external services by default.
- All collector output is wrapped as Event-IR and EvidenceEnvelope records.

## 4. Live AI-infra readiness boundary

**Goal:** Define the transition from synthetic fixture assessment to read-only live AI/MCP fingerprinting without enabling tool execution.

**Tasks:**

- Define read-only collector capability boundaries.
- Define explicit non-execution guarantees for MCP/tool discovery.
- Require EngagementPolicy and SafetyBoundary before any live-local discovery.
- Keep external/public scanning blocked by default.

**Acceptance:**

- Live readiness doctrine exists before any live collector lands.
- Collector work starts from schema and fail-closed policy, not from runtime probing.

## 5. SocioSphere-ready dashboard export

**Goal:** Emit a compact dashboard JSON artifact from verified run summaries.

**Tasks:**

- Add a dashboard export command.
- Include run status, safety posture, artifact counts, domain-lane counts, and receipt hash references.
- Keep it derived from verified summaries only.

**Acceptance:**

- Dashboard export refuses unverified runs.
- Dashboard JSON is deterministic and safe for non-production ingestion.
