# SCOPE-D Next Runtime Backlog

GitHub Issues are currently disabled for this repository, so this file captures the immediate implementation backlog until issue tracking is enabled.

## 1. First vertical slice

**Goal:** Implement the path:

`Synthetic Event -> Event-IR -> Identity-IR -> ProofArtifact -> ControlLoopRun -> RunReceipt -> RunSummary -> Ontogenesis export`

**Tasks:**

- Extend `scope-d:init` or add a dedicated runner to emit:
  - `event-ir.jsonl`
  - `identity-ir.json`
  - `proof-artifact.json`
- Link these artifacts from `control-loop.json` and `receipt.json`.
- Update `verify-run.js` to validate and hash the new artifacts when present.
- Update `report-run.js` to surface Event-IR, Identity-IR, and ProofArtifact counts.
- Update `export-ontogenesis-rdf.js` to emit triples for Event-IR, Identity-IR, proof claims, dynamic metrics, and configuration volume.

**Acceptance:**

- CI synthetic run emits the full vertical slice.
- `npm test` remains green.
- No live execution, credentials, public scanning, network egress, or production write is introduced.

## 2. Engagement policy enforcement

**Goal:** Make `EngagementPolicy` active, not just documented.

**Tasks:**

- Add an `--engagement-policy` option to `scope-d:init` and future runners.
- Validate the policy against `config/schemas/engagement-policy.schema.json`.
- Refuse production/customer/public targets unless the policy explicitly authorizes them.
- Require Michael Heller approval metadata for any future write/network/deployment/identity mutation action.

**Acceptance:**

- Synthetic lab examples run without manual approval.
- Unsafe policies fail closed.
- No runner can silently exceed `synthetic_only`, `read_only`, or `dry_run`.

## 3. AI-infra synthetic vertical slice

**Goal:** Use the AI-infra lane as the first operational assessment scenario.

**Tasks:**

- Add a synthetic MCP/tool-risk fixture.
- Emit Event-IR for tool manifest inspection.
- Emit Identity-IR only for synthetic/scoped subjects.
- Emit ProofArtifact for capability-boundary and tool-poisoning risk.
- Add a countermeasure candidate in recommendation-only mode.

**Acceptance:**

- The run is fully synthetic and verified.
- Ontogenesis export includes the AI-infra assessment evidence and proof claim.

## 4. Graph robustness fixture

**Goal:** Move graph robustness from README-level doctrine to a runnable synthetic test.

**Tasks:**

- Add a small synthetic identity/trust graph fixture.
- Add edge-injection and node-injection perturbation fixtures.
- Emit GraphRobustnessAssessment evidence.
- Emit ProofArtifact with configuration volume and dynamic path-cost fields.

**Acceptance:**

- Critical path stability can be scored before/after perturbation.
- No generic offensive graph-attack tooling is shipped.

## 5. 23-topic operating map runner

**Goal:** Turn `config/scope-d-lsa-map.json` into dashboard and orchestration input.

**Tasks:**

- Add a validator for topic IDs, prime vector set, and cross-topic edges.
- Add a report command that renders topic coverage and missing proof artifacts.
- Add a dashboard-ready JSON export.

**Acceptance:**

- Topic map is validated in CI.
- Output distinguishes captured design from implemented proof-producing lanes.

## 6. Runtime collector policy

**Goal:** Prepare for future collectors without violating safety doctrine.

**Tasks:**

- Define collector capability boundaries.
- Require EngagementPolicy and SafetyBoundary checks before collector execution.
- Start with read-only local synthetic collectors only.

**Acceptance:**

- No collector can contact external services by default.
- All collector output is wrapped as Event-IR and EvidenceEnvelope records.
