# SCOPE-D Next Runtime Backlog

GitHub Issues are currently disabled for this repository, so this file captures the immediate implementation backlog until issue tracking is enabled.

## Completed in the current contract pass

The first generic contract vertical slice is now implemented for synthetic runs:

`EngagementPolicy -> SyntheticEvent -> Event-IR -> Identity-IR -> ProofArtifact -> ControlLoopRun -> RunReceipt -> RunSummary -> DashboardSummary -> Ontogenesis export`

Completed generic work:

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
- `export-dashboard-summary.js` emits `dashboard-summary.json` from verified run summaries only.
- `export-ontogenesis-rdf.js` emits triples for Event-IR, Identity-IR, ProofArtifact, dynamic metric, configuration volume, and archetype metadata when present.
- `config/scope-d-lsa-map.json` is validated by `config/schemas/scope-d-lsa-map.schema.json` and `npm test`.
- `scope-d:init` now requires `--engagement-policy` and fails closed when policy is absent, unreadable, schema-invalid, or unauthorized for the requested target/surface/mode.
- Generated runs now copy the active policy into `engagement-policy.json`, link it from `control-loop.json`, hash it in the receipt, and verify it through `verify-run.js`.
- `npm test` includes engagement-policy fail-closed tests for missing policy, missing file, schema invalidity, empty authorized targets, unauthorized target, unauthorized mode, and `live_engage` without Michael approval requirement.

The first AI-infra synthetic vertical slice is implemented:

`Synthetic MCP Tool Manifest -> AIInfraAssessment -> MCPToolRisk -> CountermeasureRule -> Event-IR -> Identity-IR -> ProofArtifact -> ControlLoopRun -> Receipt -> DashboardSummary -> Ontogenesis export`

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
- `export-dashboard-summary.js` surfaces AI-infra lane status when present.
- `export-ontogenesis-rdf.js` emits AI-infra, MCP-risk, and countermeasure triples when present.
- `npm test` includes `test-ai-infra-slice.js`.
- CI explicitly runs the AI-infra synthetic vertical slice.

The first graph-robustness synthetic vertical slice is implemented:

`Synthetic Trust Graph Fixture -> GraphRobustnessAssessment -> Event-IR -> Identity-IR -> graph_path_cost ProofArtifact -> ControlLoopRun -> Receipt -> DashboardSummary -> Ontogenesis export`

Completed graph-robustness work:

- Added `fixtures/synthetic/graph-robustness.identity-trust.synthetic.json`.
- Added `scope-d:init-graph-robustness` runner.
- Generated graph runs emit:
  - `graph-fixture.synthetic.json`
  - `graph-robustness-assessment.json`
  - standard Event-IR / Identity-IR / ProofArtifact / ControlLoop / Receipt artifacts.
- `verify-run.js` validates GraphRobustnessAssessment when present and checks its ProofArtifact / ControlLoop references.
- `report-run.js` surfaces GraphRobustnessAssessment counts.
- `export-dashboard-summary.js` surfaces graph robustness lane status when present.
- `export-ontogenesis-rdf.js` emits graph-robustness triples when present.
- `npm test` includes `test-graph-robustness-slice.js`.
- CI explicitly runs the graph-robustness synthetic vertical slice.

The 23-topic operating map report is implemented:

`config/scope-d-lsa-map.json -> reports/scope-d-lsa-map-report.json -> reports/scope-d-lsa-map-report.md`

Completed LSA reporting work:

- Added `config/schemas/lsa-map-report.schema.json`.
- Added `scope-d:report-lsa-map` command.
- Generated report distinguishes `proof_producing` topics from `captured_design` topics.
- `npm test` includes reporting smoke coverage through `test-reporting-exports.js`.
- CI explicitly generates and verifies the LSA map report.

The collector-policy contract layer is implemented:

`CollectorPolicy schema -> valid fixture -> invalid fixtures -> fail-closed tests -> docs`

Completed collector-policy work:

- Added `config/schemas/collector-policy.schema.json`.
- Added `examples/scope-d/collector-policy.example.json`.
- Added invalid fixtures for:
  - unknown collector type,
  - wildcard filesystem path,
  - command execution allowed,
  - network egress allowed.
- Added `scripts/test-collector-policy.js`.
- Wired collector-policy validation into `npm test` and `validate-contracts.js`.
- Added `docs/COLLECTOR-POLICY.md`.
- CI explicitly runs collector-policy fail-closed tests.

## 1. Confirm CI and enforce branch protection

**Goal:** Make the contract-validation workflow a required gate.

**Tasks:**

- Confirm `.github/workflows/contract-validation.yml` runs green on latest `main`.
- Require the workflow in branch protection.
- Prefer PR-based changes over direct commits once branch protection is active.

**Acceptance:**

- Latest `main` commit has a passing contract-validation workflow.
- Direct contract drift cannot land without validation.

## 2. Live readiness doctrine

**Goal:** Define the transition from synthetic fixture assessment to any read-only live collector without enabling tool execution or network probing.

**Tasks:**

- Define live-readiness gates.
- Define explicit non-execution guarantees for read-only live collectors.
- Require EngagementPolicy, CollectorPolicy, and SafetyBoundary before any live-local discovery.
- Keep external/public scanning blocked by default.
- Define no-credential/no-secret/no-process-argument collection constraints.

**Acceptance:**

- Live readiness doctrine exists before any live collector lands.
- Collector work starts from schema and fail-closed policy, not from runtime probing.

## 3. Detection-as-code synthetic examples

**Goal:** Add detection-as-code examples linked to synthetic expected telemetry.

**Tasks:**

- Add one Sigma or OPA/Rego example tied to existing synthetic event output.
- Validate the detection/countermeasure rule through existing schemas.
- Keep deployment status experimental or hunt-only.

**Acceptance:**

- Detection example is linked to synthetic expected telemetry.
- No production deployment claim is made.

## 4. Issue/project tracking restoration

**Goal:** Replace file-only backlog with normal repo tracking.

**Tasks:**

- Enable GitHub Issues or create an equivalent project-board workflow.
- Convert major backlog sections into issues.
- Preserve `docs/NEXT_RUNTIME_BACKLOG.md` as a generated/curated summary only.

## 5. PolicyFabric admission bridge sketch

**Goal:** Sketch how repo-local EngagementPolicy and CollectorPolicy decisions become future PolicyFabric admission decisions.

**Tasks:**

- Define handoff fields.
- Define refused states.
- Keep this as a design sketch until PolicyFabric runtime integration exists.
