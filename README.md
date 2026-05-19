# SCOPE-D: SocioProphet Defensive Purple-Team Control Fabric

SCOPE-D is the SocioProphet derivative of SCOPE. It starts from the upstream SCOPE agentic AWS purple-team loop and extends it toward a broader, governed, defensive security control fabric for cloud, GitHub, Kubernetes, local hosts, AI infrastructure, MCP/tool servers, agent skills, threat-intel feeds, detection validation, graph robustness, identity-boundary reasoning, and SourceOS integration.

The goal is not to ship another narrow scanner. The goal is a policy-gated cybernetic security loop: collect evidence, reason over attack paths, validate detections, generate countermeasures, preserve provenance, and keep operators in control.

## Current status

SCOPE-D is early-stage derivative work. The inherited upstream SCOPE implementation is useful, but this repository is now being shaped around the SocioProphet / SourceOS architecture.

The current repository has a real contract-first substrate, not just prose. It includes schema/example validation, synthetic event generation, engagement-policy-gated synthetic run initialization, AI-infra synthetic run initialization, graph-robustness synthetic run initialization, run verification, run reporting, dashboard export, Ontogenesis export, 23-topic LSA map reporting, collector-policy fail-closed validation, and tamper-detection smoke testing.

The Wargames work is also now contract-backed, but not runtime-backed. The repository contains Wargames doctrine capture plus schema-backed, example-backed, negative-fixture-backed, validator-backed contracts for BoundaryEvent/evidence/Scout proof, engagement authorization, the 23-topic LSA/LSI map, OFIF/SynapseIQ activation envelopes, Ontogenesis/ATT&CK semantic export, and MeshRush/HellGraph export. These are static governance artifacts. They do not run Scout or Whisper, ingest live telemetry, execute engagement actions, deliver OFIF outputs, run SynapseIQ enrichment, traverse MeshRush graphs, or replay HellGraph streams.

This is deliberate contract-driven development. In SCOPE-D, contracts are the first deliverable, not incidental scaffolding. A CI-validated schema with positive fixtures and negative fixtures is a security artifact: it defines the allowed and forbidden states before any runtime is permitted to exist.

Generated synthetic runs now emit the first complete contract vertical slice:

`EngagementPolicy -> SyntheticEvent -> Event-IR -> Identity-IR -> ProofArtifact -> ControlLoopRun -> RunReceipt -> RunSummary -> DashboardSummary -> Ontogenesis export`

The AI-infra synthetic runner extends that slice with:

`Synthetic MCP Tool Manifest -> AIInfraAssessment -> MCPToolRisk -> CountermeasureRule -> ProofArtifact -> DashboardSummary -> Ontogenesis export`

The graph-robustness synthetic runner extends that slice with:

`Synthetic Trust Graph Fixture -> GraphRobustnessAssessment -> graph_path_cost ProofArtifact -> DashboardSummary -> Ontogenesis export`

The collector-policy layer is now schema-backed and test-gated, but it is deliberately pre-runtime: it defines fail-closed collector registration rules before any live collector lands.

Status ledger:

- `docs/IMPLEMENTATION_STATUS.md` — current truth table for implemented, prototype-grade, captured-design, and not-yet-implemented surfaces.

Initial SCOPE-D additions include:

- `docs/SCOPE-D-STRATEGY.md` — derivative thesis, reference-framework synthesis, safety doctrine, roadmap.
- `docs/ENGAGEMENT-POLICY.md` — initial engagement authority, target-boundary, escalation, and identity-handling doctrine.
- `docs/COLLECTOR-POLICY.md` — collector capability boundaries, no-execution guarantees, fail-closed behavior, and audit requirements.
- `docs/IDENTITY-PRIME-INTEGRATION.md` — Identity-IR, Event-IR, ProofArtifact, and prime-lane integration notes.
- `config/schemas/scope-d-control-loop.schema.json` — first SCOPE-D control-loop contract.
- `config/schemas/event-ir.schema.json` — typed operational event record for synthetic and future collector events.
- `config/schemas/identity-ir.schema.json` — identity-prime bridge from Event-IR into scoped prime lanes and wells.
- `config/schemas/proof-artifact.schema.json` — proof output contract with dynamic metric, configuration volume, and archetype fields.
- `config/schemas/engagement-policy.schema.json` — machine-readable authorization and rules-of-engagement boundary.
- `config/schemas/collector-policy.schema.json` — fail-closed collector registration and capability-boundary contract.
- `config/schemas/dashboard-export.schema.json` — verified-run dashboard export contract.
- `config/schemas/lsa-map-report.schema.json` — 23-topic LSA map report contract.
- `examples/scope-d/engagement-policy.synthetic.json` — canonical synthetic-only policy fixture for local and CI runs.
- `examples/scope-d/collector-policy.example.json` — canonical synthetic/read-only collector policy fixture.
- `config/schemas/scope-d-lsa-map.schema.json` — validation contract for the 23-topic operating map.
- `config/scope-d-lsa-map.json` — durable 23-topic operating map and cross-topic links.
- `fixtures/synthetic/mcp-tool-manifest.tool-poisoning.synthetic.json` — synthetic MCP/tool-risk manifest fixture.
- `fixtures/synthetic/graph-robustness.identity-trust.synthetic.json` — synthetic identity/trust graph robustness fixture.
- `exercises/templates/atomic-testcase.template.json` — safe atomic validation manifest template.
- `ai-infra/README.md` — AI infrastructure, MCP, tool, and skill-risk assessment surface.
- `graph-robustness/README.md` — graph-adversarial robustness assessment surface.
- `detections/README.md` — detection and countermeasure packaging doctrine.

## Implemented contract commands

```bash
npm test
npm run synthetic:event -- examples/scope-d/atomic-testcase.example.json runs/synthetic-lab/events.jsonl
npm run scope-d:init -- --run-id scope-d-local-synthetic-lab --target local-scope-d-lab --engagement-policy examples/scope-d/engagement-policy.synthetic.json
npm run scope-d:init-ai-infra -- --run-id scope-d-local-ai-infra-lab --target local-ai-infra-lab --engagement-policy examples/scope-d/engagement-policy.synthetic.json
npm run scope-d:init-graph-robustness -- --run-id scope-d-local-graph-robustness-lab --target local-graph-robustness-lab --engagement-policy examples/scope-d/engagement-policy.synthetic.json
npm run scope-d:verify-run -- runs/scope-d-local-synthetic-lab
npm run scope-d:report-run -- runs/scope-d-local-synthetic-lab
npm run scope-d:export-dashboard -- runs/scope-d-local-synthetic-lab
npm run scope-d:export-ontogenesis -- runs/scope-d-local-synthetic-lab
npm run scope-d:report-lsa-map
npm run test:engagement-policy
npm run test:collector-policy
npm run test:ai-infra
npm run test:graph-robustness
npm run test:reporting
npm run test:tamper
```

`scope-d:init`, `scope-d:init-ai-infra`, and `scope-d:init-graph-robustness` are fail-closed: absence of `--engagement-policy`, an unreadable policy path, schema-invalid policy, unauthorized target, unauthorized surface, or unauthorized mode causes the run to fail. There is no silent synthetic-only fallback.

Collector policies are also fail-closed contracts. Unknown collector types, wildcard filesystem scopes, command execution, process spawning, plugin loading, network egress, public scanning, credential collection, and silent reads are rejected by schema or test gates before any collector runtime exists.

Dashboard exports are derived only from verified run summaries and are marked non-production-only. The 23-topic LSA map report distinguishes proof-producing topics from captured-design topics.

The GitHub Actions workflow `.github/workflows/contract-validation.yml` runs contract validation, synthetic event generation, engagement-policy-gated safe run initialization, AI-infra synthetic vertical-slice initialization, graph-robustness synthetic vertical-slice initialization, run verification, reporting, dashboard export, Ontogenesis export, 23-topic LSA map reporting, engagement-policy fail-closed tests, collector-policy fail-closed tests, AI-infra smoke tests, graph-robustness smoke tests, reporting smoke tests, and tamper detection.

## What SCOPE-D inherits from upstream SCOPE

Upstream SCOPE contributes a useful starting loop:

- AWS enumeration agents;
- attack-path reasoning;
- defensive control generation;
- exploit playbook generation under read-only doctrine;
- SOC hunt workflow;
- schema validation;
- lifecycle hooks;
- dashboard artifacts;
- Claude Code, Gemini CLI, and Codex-oriented agent packaging.

We retain attribution and license clarity. SCOPE-D is a derivative direction, not a claim that the upstream project already contains the expanded SocioProphet architecture described here.

## What SCOPE-D adds

SCOPE-D expands the design into these lanes:

| Lane | Purpose |
|---|---|
| Control-loop contracts | Typed runs, gates, evidence envelopes, artifacts, controls, and attack graphs |
| Engagement policy | Machine-readable authority, target-boundary, escalation, and blocked-action rules |
| Collector policy | Fail-closed collector registration, capability boundaries, no-execution guarantees, and no-silent-read audit requirements |
| Event-IR / Identity-IR | Typed events and scoped identity-prime evidence with wells and provenance |
| Proof artifacts | Non-escape, budget, dynamic-metric, configuration-volume, archetype, and validation claims |
| Purple-team exercises | Formal exercise objectives, rules of engagement, roles, metrics, and lessons learned |
| Atomic validation | Safe ATT&CK/ATLAS-mapped tests with prerequisites, expected telemetry, cleanup, and regression tracking |
| Threat intelligence | Indicator lifecycle, confidence, decay, TLP/PAP markings, enrichment, and feed-to-detection flow |
| Detection-as-code | Sigma, SPL, YARA, Snort/Suricata, ClamAV, OSQuery, OPA/Rego, cloud, GitHub, Kubernetes, and SourceOS policy artifacts |
| AI infrastructure assessment | Synthetic MCP/tool-risk slice now implemented; live model/MCP assessment remains future work |
| Graph robustness | Synthetic edge-injection trust-graph slice now implemented; live graph assessment remains future work |
| 23-topic operating map | Validated config and generated coverage report now implemented; orchestration remains future work |
| Wargames contract stack | Static contracts for evidence, authorization, LSA/LSI, OFIF/SynapseIQ, Ontogenesis/ATT&CK, and MeshRush/HellGraph; runtime remains future work |
| SourceOS integration | PolicyFabric, AgentPlane, SocioSphere, TurtleTerm, sourceos-shell, openclaw, and memory-mesh alignment |

## Safety doctrine

SCOPE-D defaults to read-only collection, synthetic validation, and dry-run execution.

Any action that changes infrastructure, modifies identity, deploys code, executes exploit logic, runs payloads, contacts external services, mutates logs, changes policy, or writes to production systems requires an explicit gate and policy decision.

SCOPE-D may study offensive projects for taxonomy, observables, and detection validation, but it must not import deployable malware, C2 payloads, stealth logic, destructive automation, credential theft behavior, or unauthorized-execution workflows.

## Reference frameworks we are learning from

SCOPE-D explicitly studies and selectively absorbs safe lessons from:

- upstream SCOPE for agentic cloud purple-team orchestration;
- Purple Team Exercise Framework for operating model, roles, metrics, and maturity;
- Atomic Red Team for reproducible ATT&CK-mapped validation tests;
- GreedyBear and CIF-style threat-intel systems for feed ingestion and indicator lifecycle;
- Mandiant red-team tool countermeasures for countermeasure packaging and maturity states;
- AI-Infra-Guard for AI infrastructure, MCP, tool, skill, and jailbreak-risk assessment;
- graph-adversarial-learning research and DeepRobust for graph robustness assessment;
- C2 simulation projects only as defensive emulation taxonomy, never as executable offensive capability.

## Repository layout direction

```text
SCOPE-D
├── agents/                         inherited and future SCOPE-D agents
├── config/schemas/                 machine-readable contracts
├── detections/                     detection and countermeasure packaging
├── exercises/                      purple-team and atomic validation templates
├── ai-infra/                       AI infrastructure assessment lane
├── graph-robustness/               graph attack/defense assessment lane
├── dashboard/                      inherited and future reporting UX
└── docs/                           derivative strategy and architecture
```

## Immediate roadmap

1. Keep contract validation green after every schema/example addition and require the validation workflows in branch protection.
2. Decide and land the runtime-layer architecture or a minimal contract resolver before any live agent, adapter, collector, replay, or client-delivery runtime is introduced.
3. Define live-readiness doctrine before any read-only live collectors land.
4. Add detection-as-code examples linked to synthetic expected telemetry.
5. Add issue/project tracking once GitHub Issues or a replacement board is enabled.
6. Add PolicyFabric admission integration only after collector/readiness doctrine is complete.

## Upstream attribution

SCOPE-D is derived from the public SCOPE project created by Tayvion Payton. See the inherited license and upstream project history for original authorship and licensing context.

Original upstream: https://github.com/tayontech/SCOPE
