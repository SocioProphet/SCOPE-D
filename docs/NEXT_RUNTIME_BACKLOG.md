# SCOPE-D Next Runtime Backlog

GitHub Issues are currently disabled for this repository, so this file captures the immediate implementation backlog until issue tracking is enabled.

## Completed in the current contract pass

The first generic contract vertical slice is now implemented for synthetic runs:

`SyntheticEvent -> Event-IR -> Identity-IR -> ProofArtifact -> ControlLoopRun -> RunReceipt -> RunSummary -> Ontogenesis export`

Completed work:

- `scope-d:init` emits:
  - `events.jsonl`
  - `event-ir.jsonl`
  - `identity-ir.json`
  - `proof-artifact.json`
  - `control-loop.json`
  - `receipt.json`
  - `report.md`
- `verify-run.js` validates Event-IR, Identity-IR, ProofArtifact, receipt hashes, and cross-artifact references.
- `report-run.js` surfaces Event-IR, Identity-IR, and ProofArtifact counts.
- `export-ontogenesis-rdf.js` emits triples for Event-IR, Identity-IR, ProofArtifact, dynamic metric, configuration volume, and archetype metadata when present.
- `config/scope-d-lsa-map.json` is validated by `config/schemas/scope-d-lsa-map.schema.json` and `npm test`.

## 1. Confirm CI and enforce branch protection

**Goal:** Make the contract-validation workflow a required gate.

**Tasks:**

- Confirm `.github/workflows/contract-validation.yml` runs green on latest `main`.
- Require the workflow in branch protection.
- Prefer PR-based changes over direct commits once branch protection is active.

**Acceptance:**

- Latest `main` commit has a passing contract-validation workflow.
- Direct contract drift cannot land without validation.

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

**Goal:** Use the AI-infra lane as the first domain-specific assessment scenario.

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

- Add a report command that renders topic coverage and missing proof artifacts.
- Add a dashboard-ready JSON export.
- Distinguish captured-design topics from proof-producing lanes.

**Acceptance:**

- Topic map remains validated in CI.
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
