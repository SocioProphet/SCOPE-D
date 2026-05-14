# SCOPE-D: SocioProphet Defensive Purple-Team Control Fabric

SCOPE-D is the SocioProphet derivative of SCOPE. It starts from the upstream SCOPE agentic AWS purple-team loop and extends it toward a broader, governed, defensive security control fabric for cloud, GitHub, Kubernetes, local hosts, AI infrastructure, MCP/tool servers, agent skills, threat-intel feeds, detection validation, graph robustness, identity-boundary reasoning, and SourceOS integration.

The goal is not to ship another narrow scanner. The goal is a policy-gated cybernetic security loop: collect evidence, reason over attack paths, validate detections, generate countermeasures, preserve provenance, and keep operators in control.

## Current status

SCOPE-D is early-stage derivative work. The inherited upstream SCOPE implementation is useful, but this repository is now being shaped around the SocioProphet / SourceOS architecture.

The current repository has a real contract-first substrate, not just prose. It includes schema/example validation, synthetic event generation, engagement-policy-gated synthetic run initialization, AI-infra synthetic run initialization, run verification, run reporting, Ontogenesis export, and tamper-detection smoke testing.

Generated synthetic runs now emit the first complete contract vertical slice:

`EngagementPolicy -> SyntheticEvent -> Event-IR -> Identity-IR -> ProofArtifact -> ControlLoopRun -> RunReceipt -> RunSummary -> Ontogenesis export`

The AI-infra synthetic runner extends that slice with:

`Synthetic MCP Tool Manifest -> AIInfraAssessment -> MCPToolRisk -> CountermeasureRule -> ProofArtifact -> Ontogenesis export`

Status ledger:

- `docs/IMPLEMENTATION_STATUS.md` — current truth table for implemented, prototype-grade, captured-design, and not-yet-implemented surfaces.

Initial SCOPE-D additions include:

- `docs/SCOPE-D-STRATEGY.md` — derivative thesis, reference-framework synthesis, safety doctrine, roadmap.
- `docs/ENGAGEMENT-POLICY.md` — initial engagement authority, target-boundary, escalation, and identity-handling doctrine.
- `docs/IDENTITY-PRIME-INTEGRATION.md` — Identity-IR, Event-IR, ProofArtifact, and prime-lane integration notes.
- `config/schemas/scope-d-control-loop.schema.json` — first SCOPE-D control-loop contract.
- `config/schemas/event-ir.schema.json` — typed operational event record for synthetic and future collector events.
- `config/schemas/identity-ir.schema.json` — identity-prime bridge from Event-IR into scoped prime lanes and wells.
- `config/schemas/proof-artifact.schema.json` — proof output contract with dynamic metric, configuration volume, and archetype fields.
- `config/schemas/engagement-policy.schema.json` — machine-readable authorization and rules-of-engagement boundary.
- `examples/scope-d/engagement-policy.synthetic.json` — canonical synthetic-only policy fixture for local and CI runs.
- `config/schemas/scope-d-lsa-map.schema.json` — validation contract for the 23-topic operating map.
- `config/scope-d-lsa-map.json` — durable 23-topic operating map and cross-topic links.
- `fixtures/synthetic/mcp-tool-manifest.tool-poisoning.synthetic.json` — synthetic MCP/tool-risk manifest fixture.
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
npm run scope-d:verify-run -- runs/scope-d-local-synthetic-lab
npm run scope-d:report-run -- runs/scope-d-local-synthetic-lab
npm run scope-d:export-ontogenesis -- runs/scope-d-local-synthetic-lab
npm run test:engagement-policy
npm run test:ai-infra
npm run test:tamper
```

`scope-d:init` and `scope-d:init-ai-infra` are fail-closed: absence of `--engagement-policy`, an unreadable policy path, schema-invalid policy, unauthorized target, unauthorized surface, or unauthorized mode causes the run to fail. There is no silent synthetic-only fallback.

The GitHub Actions workflow `.github/workflows/contract-validation.yml` runs contract validation, synthetic event generation, engagement-policy-gated safe run initialization, AI-infra synthetic vertical-slice initialization, run verification, reporting, Ontogenesis export, engagement-policy fail-closed tests, AI-infra smoke tests, and tamper detection.

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
| Event-IR / Identity-IR | Typed events and scoped identity-prime evidence with wells and provenance |
| Proof artifacts | Non-escape, budget, dynamic-metric, configuration-volume, archetype, and validation claims |
| Purple-team exercises | Formal exercise objectives, rules of engagement, roles, metrics, and lessons learned |
| Atomic validation | Safe ATT&CK/ATLAS-mapped tests with prerequisites, expected telemetry, cleanup, and regression tracking |
| Threat intelligence | Indicator lifecycle, confidence, decay, TLP/PAP markings, enrichment, and feed-to-detection flow |
| Detection-as-code | Sigma, SPL, YARA, Snort/Suricata, ClamAV, OSQuery, OPA/Rego, cloud, GitHub, Kubernetes, and SourceOS policy artifacts |
| AI infrastructure assessment | Synthetic MCP/tool-risk slice now implemented; live model/MCP assessment remains future work |
| Graph robustness | Defensive testing for attack graphs, trust graphs, policy graphs, memory graphs, and governance graphs |
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

1. Keep contract validation green after every schema/example addition.
2. Add graph robustness synthetic fixture and edge-injection scoring proof.
3. Add read-only AI-infra and MCP surface fingerprinting.
4. Add detection-as-code examples linked to synthetic expected telemetry.
5. Add dashboard panels for exercise maturity, detection coverage, AI infra risk, graph robustness, and run receipts.
6. Add branch protection requiring the contract-validation workflow once CI status is confirmed green.

## Upstream attribution

SCOPE-D is derived from the public SCOPE project created by Tayvion Payton. See the inherited license and upstream project history for original authorship and licensing context.

Original upstream: https://github.com/tayontech/SCOPE
