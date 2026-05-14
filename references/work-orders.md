# SCOPE-D Reference Assimilation Work Orders

Generated deterministically from `references/scope-d-reference-catalog.json`. Do not edit work orders by hand; update the catalog and regenerate.

## Guardrails

- All work orders are defensive by default.
- Dual-use and adversary-emulation references are taxonomy-only unless explicitly reclassified by policy.
- No payloads, C2 code, credential theft behavior, destructive automation, or evasion logic may be imported.
- Every implementation task must preserve SCOPE-D safety boundaries, synthetic-first validation, and receipt verification.

## WO-001: tayontech/SCOPE

- Reference ID: `ref-upstream-scope`
- URL: https://github.com/tayontech/SCOPE
- Category: `agentic_cloud_purple_team`
- Adoption mode: `pattern_extract`
- Safety class: `safe_defensive`
- Capability targets: `control_loop`, `policy_gates`, `run_receipts`, `dashboard_handoff`

### Lessons

- Agent/subagent orchestration is a useful operating model for security loops.
- File-based handoff reduces context contamination and makes evidence replayable.
- Read-only default posture and artifact validation should be mandatory.

### Do not import

- Do not preserve upstream-only branding as the SCOPE-D product surface.
- Do not rely on prompt-only control boundaries.

### Next actions

- Map upstream audit/defend/hunt outputs into SCOPE-D ControlLoopRun and EvidenceEnvelope contracts.
- Replace AWS-specific assumptions with provider-neutral target surfaces.

## WO-002: SCYTHE Purple Team Exercise Framework

- Reference ID: `ref-ptef`
- URL: https://github.com/scythe-io/purple-team-exercise-framework
- Category: `purple_team_methodology`
- Adoption mode: `contract_mapping`
- Safety class: `safe_defensive`
- Capability targets: `exercise_model`, `policy_gates`, `dashboard_handoff`

### Lessons

- Exercises need objectives, roles, scope, rules of engagement, metrics, and lessons learned.
- Continuous purple teaming should become a regression loop, not an ad-hoc event.

### Do not import

- Do not copy templates blindly; map them into SCOPE-D contracts.

### Next actions

- Expand PurpleTeamExercise with maturity scoring and exercise phase tracking.
- Generate exercise summaries from verified runs.

## WO-003: Atomic Red Team

- Reference ID: `ref-atomic-red-team`
- URL: https://github.com/redcanaryco/atomic-red-team
- Category: `atomic_validation`
- Adoption mode: `contract_mapping`
- Safety class: `safe_defensive`
- Capability targets: `atomic_tests`, `synthetic_events`, `countermeasure_packaging`

### Lessons

- Portable ATT&CK-mapped tests are the right regression primitive for detections.
- Each test needs prerequisites, executor mode, expected telemetry, cleanup, and rollback metadata.

### Do not import

- Do not enable live execution by default.
- Do not import tests that mutate systems without gates.

### Next actions

- Add an AtomicTestCase import/mapping guide.
- Add synthetic-only test fixtures for high-risk ATT&CK techniques.

## WO-004: GreedyBear

- Reference ID: `ref-greedybear`
- URL: https://github.com/GreedyBear-Project/GreedyBear
- Category: `threat_intel`
- Adoption mode: `pattern_extract`
- Safety class: `safe_defensive`
- Capability targets: `threat_intel_feeds`, `countermeasure_packaging`, `dashboard_handoff`

### Lessons

- Honeypot and sensor observations should become threat-intel feeds and detection candidates.
- Observed hostile behavior should drive prevention and detection feeds.

### Do not import

- Do not ingest untrusted feed data without TLP/PAP, confidence, and decay metadata.

### Next actions

- Add honeypot/sensor feed adapter skeletons.
- Map feed indicators into IndicatorRecord and CountermeasureRule contracts.

## WO-005: CSIRT Gadgets Bearded Avenger / CIF lineage

- Reference ID: `ref-bearded-avenger`
- URL: https://github.com/csirtgadgets/bearded-avenger
- Category: `threat_intel`
- Adoption mode: `pattern_extract`
- Safety class: `safe_defensive`
- Capability targets: `threat_intel_feeds`, `dashboard_handoff`

### Lessons

- Threat intelligence needs ecosystem connectors and lifecycle semantics.
- Feeds should support confidence, sharing markings, enrichment, and downstream integrations.

### Do not import

- Do not clone legacy deployment assumptions; preserve only feed lifecycle and integration patterns.

### Next actions

- Add CIF-style feed fields to threat-intel examples.
- Create feed-to-detection work order examples.

## WO-006: Mandiant Red Team Tool Countermeasures

- Reference ID: `ref-mandiant-countermeasures`
- URL: https://github.com/mandiant/red_team_tool_countermeasures
- Category: `countermeasure_rules`
- Adoption mode: `pattern_extract`
- Safety class: `safe_defensive`
- Capability targets: `countermeasure_packaging`, `policy_gates`, `dashboard_handoff`

### Lessons

- Countermeasure rules need maturity states and tuning expectations.
- Production rules and supplemental hunting rules should be distinguished.

### Do not import

- Do not import rules without provenance, maturity, false-positive, and rollback metadata.

### Next actions

- Add detection package examples for Sigma/SPL/YARA/OSQuery/OPA.
- Add rule maturity dashboards to run-summary handoff.

## WO-007: AI-Infra-Guard

- Reference ID: `ref-ai-infra-guard`
- URL: https://github.com/TristanInSec/AI-Infra-Guard
- Category: `ai_infra_security`
- Adoption mode: `contract_mapping`
- Safety class: `safe_defensive`
- Capability targets: `ai_infra_assessment`, `mcp_tool_risk`, `agent_skill_risk`, `synthetic_events`

### Lessons

- AI runtime, MCP, tool, skill, and jailbreak risk must be first-class surfaces.
- Plugin-style fingerprints and risk rules are useful but need SourceOS safety gates.

### Do not import

- Do not expose unauthenticated scanners or public-network scanning defaults.
- Do not run jailbreak/live risk tests against third-party services by default.

### Next actions

- Add read-only AI runtime fingerprint fixtures.
- Add MCP tool risk fixture corpus and synthetic detection events.

## WO-008: Awesome Graph Adversarial Learning

- Reference ID: `ref-graph-adversarial-learning`
- URL: https://github.com/EdisonLeeeee/Graph-Adversarial-Learning
- Category: `graph_robustness`
- Adoption mode: `pattern_extract`
- Safety class: `research_only`
- Capability targets: `graph_robustness`, `dashboard_handoff`

### Lessons

- Attack, trust, policy, dependency, and memory graphs are adversarial surfaces.
- Node injection, edge perturbation, backdoors, membership inference, and model extraction should be tracked.

### Do not import

- Do not ship offensive graph attack tooling as a general capability.

### Next actions

- Add synthetic graph robustness fixtures for identity and trust graphs.
- Add robustness scoring to run-summary output.

## WO-009: DeepRobust

- Reference ID: `ref-deeprobust`
- URL: https://github.com/DSE-MSU/DeepRobust
- Category: `graph_robustness`
- Adoption mode: `pattern_extract`
- Safety class: `research_only`
- Capability targets: `graph_robustness`, `ai_infra_assessment`

### Lessons

- Robustness evaluation should include attack and defense experiments, not just static assertions.
- Graph robustness tests should stay synthetic/lab-scoped until policy gates approve more.

### Do not import

- Do not vendor research attack code into runtime paths without isolation and review.

### Next actions

- Create a lab-only graph perturbation harness.
- Map robustness findings into GraphRobustnessAssessment and Ontogenesis apt terms.

## WO-010: BEAR-C2

- Reference ID: `ref-bear-c2`
- URL: https://github.com/S3N4T0R-0X0/BEAR
- Category: `adversary_emulation_taxonomy`
- Adoption mode: `taxonomy_only`
- Safety class: `taxonomy_only`
- Capability targets: `synthetic_events`, `atomic_tests`, `countermeasure_packaging`

### Lessons

- Adversary-emulation profiles need observable families, technique mappings, expected detections, and safety gates.
- C2 and payload references are useful only as defensive telemetry and taxonomy seeds.

### Do not import

- Do not import payloads, stagers, C2 code, evasion logic, credential theft behavior, persistence behavior, or log tampering logic.
- Do not create execution workflows for offensive payloads.

### Next actions

- Create synthetic observable profiles for C2-like telemetry without payloads.
- Map adversary-emulation taxonomy to detection rules and Ontogenesis techniques.

## WO-011: GreedyBear public feed pattern

- Reference ID: `ref-greedybear-recheck`
- URL: https://github.com/GreedyBear-Project/GreedyBear
- Category: `threat_intel`
- Adoption mode: `direct_reference`
- Safety class: `safe_defensive`
- Capability targets: `threat_intel_feeds`, `synthetic_events`

### Lessons

- Public feed examples are useful for shaping feed output contracts.
- Feed freshness and decay are core to preventing stale detections.

### Do not import

- Do not hardcode any public feed as authoritative without confidence and decay metadata.

### Next actions

- Add feed freshness fields to run summary handoff.
- Add feed ingestion examples that remain synthetic by default.

