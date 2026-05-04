# SCOPE-D: SocioProphet Defensive Purple-Team Control Fabric

SCOPE-D is the SocioProphet derivative of SCOPE. It starts from the upstream SCOPE agentic AWS purple-team loop and extends it toward a broader, governed, defensive security control fabric for cloud, GitHub, Kubernetes, local hosts, AI infrastructure, MCP/tool servers, agent skills, threat-intel feeds, detection validation, and graph robustness.

The goal is not to ship another narrow scanner. The goal is a policy-gated cybernetic security loop: collect evidence, reason over attack paths, validate detections, generate countermeasures, preserve provenance, and keep operators in control.

## Current status

SCOPE-D is early-stage derivative work. The inherited upstream SCOPE implementation is useful, but this repository is now being shaped around the SocioProphet / SourceOS architecture.

Initial SCOPE-D additions include:

- `docs/SCOPE-D-STRATEGY.md` — derivative thesis, reference-framework synthesis, safety doctrine, roadmap.
- `config/schemas/scope-d-control-loop.schema.json` — first SCOPE-D control-loop contract.
- `exercises/templates/atomic-testcase.template.json` — safe atomic validation manifest template.
- `ai-infra/README.md` — AI infrastructure, MCP, tool, and skill-risk assessment surface.
- `graph-robustness/README.md` — graph-adversarial robustness assessment surface.
- `detections/README.md` — detection and countermeasure packaging doctrine.

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
| Purple-team exercises | Formal exercise objectives, rules of engagement, roles, metrics, and lessons learned |
| Atomic validation | Safe ATT&CK/ATLAS-mapped tests with prerequisites, expected telemetry, cleanup, and regression tracking |
| Threat intelligence | Indicator lifecycle, confidence, decay, TLP/PAP markings, enrichment, and feed-to-detection flow |
| Detection-as-code | Sigma, SPL, YARA, Snort/Suricata, ClamAV, OSQuery, OPA/Rego, cloud, GitHub, Kubernetes, and SourceOS policy artifacts |
| AI infrastructure assessment | Model servers, MCP servers, tools, skills, memory stores, vector stores, jailbreak exposure, and tool poisoning |
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

1. Complete SCOPE-D README and attribution cleanup.
2. Add schemas for `PurpleTeamExercise`, `AtomicTestCase`, `ThreatIntelFeed`, `IndicatorRecord`, `AIInfraAssessment`, `MCPToolRisk`, `AgentSkillRisk`, and `GraphRobustnessAssessment`.
3. Add example conforming payloads for each schema.
4. Add validation scripts and CI checks.
5. Add safe synthetic-event generation for detection validation.
6. Add read-only AI-infra and MCP surface fingerprinting.
7. Add graph robustness synthetic fixtures.
8. Extend the dashboard to show exercise maturity, detection coverage, AI-infra risk, and graph robustness.

## Upstream attribution

SCOPE-D is derived from the public SCOPE project created by Tayvion Payton. See the inherited license and upstream project history for original authorship and licensing context.

Original upstream: https://github.com/tayontech/SCOPE
