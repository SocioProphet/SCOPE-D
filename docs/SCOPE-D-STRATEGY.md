# SCOPE-D Strategy

SCOPE-D is the SocioProphet derivative of SCOPE. Its purpose is to evolve the upstream AWS-focused purple-team agent loop into a broader, policy-governed security control fabric for cloud, GitHub, Kubernetes, local workstations, AI infrastructure, MCP/tool servers, agent skills, and graph-based reasoning systems.

This repository must remain defensive, auditable, and operator-gated. We can study offensive frameworks for taxonomy and detection validation, but we do not import C2 payloads, destructive tradecraft, evasion code, or unauthorized-execution behavior into SCOPE-D.

## Design thesis

SCOPE-D should become a governed purple-team control loop:

1. collect scoped evidence from approved surfaces;
2. normalize observations into machine-checkable artifacts;
3. map findings to ATT&CK, ATLAS, identity, cloud, software-supply-chain, and AI-agent risk models;
4. reason over attack paths and defensive gaps;
5. generate countermeasure candidates;
6. validate detections through safe atomic tests and simulated evidence;
7. gate every write, exploit, deployment, or destructive action;
8. produce portable reports, dashboards, receipts, and regression tests.

Upstream SCOPE gives us the initial agent loop. SCOPE-D adds durable contracts, purple-team methodology, AI infrastructure coverage, threat-intel ingestion, detection-as-code, and graph robustness.

## Reference framework lessons

### Upstream SCOPE

Useful elements:

- agent/subagent orchestration;
- file-based handoff between enumeration, attack-path reasoning, defend, exploit, hunt, and dashboard phases;
- run directories and artifact checks;
- schema validation;
- read-only default posture;
- operator gates.

Required SCOPE-D improvement:

- move from AWS-only to provider-neutral surfaces;
- replace prompt-only controls with typed policy and capability enforcement;
- formalize cross-tenant memory isolation;
- separate exploit playbook generation from any execution pathway;
- make every artifact reusable by SourceOS/SociOS contracts.

### Purple Team Exercise Framework

SCOPE-D needs an exercise operating model, not just tools. Add first-class support for:

- exercise objectives;
- roles and responsibilities;
- rules of engagement;
- CTI intake;
- detection-engineering lifecycle;
- metrics and maturity scoring;
- continuous regression exercises.

### Atomic Red Team

SCOPE-D should support atomic, reproducible, safety-classed validation tests mapped to MITRE ATT&CK.

Required capabilities:

- atomic test manifests;
- prerequisites and cleanup metadata;
- expected telemetry;
- expected detection controls;
- no-op/dry-run mode;
- synthetic-event mode for high-risk tests;
- detection regression tracking.

### GreedyBear and Bearded Avenger / CIF-style feeds

SCOPE-D should ingest hostile observations and threat-intel feeds, not just scan owned assets.

Required capabilities:

- indicator lifecycle;
- TLP/PAP marking;
- confidence and decay;
- enrichment pipeline;
- feed-to-detection generation;
- honeypot and sensor evidence import.

### Mandiant red-team tool countermeasures

SCOPE-D countermeasures should be packaged with maturity and tuning status.

Required statuses:

- `production` — expected to work with minimal tuning;
- `supplemental` — useful but environment-specific;
- `hunt_only` — analyst-driven, not production alerting;
- `experimental` — under evaluation;
- `deprecated` — retained for historical mapping only.

Required rule families:

- Sigma;
- SPL;
- YARA;
- Snort/Suricata;
- ClamAV;
- OSQuery;
- OPA/Rego;
- Kubernetes policy;
- GitHub/repository policy;
- SourceOS policy.

### AI-Infra-Guard

SCOPE-D must treat AI infrastructure as a first-class attack surface.

Required surfaces:

- model servers such as Ollama, vLLM, and similar runtimes;
- agent skills;
- MCP servers and tools;
- vector stores and memory stores;
- prompt/jailbreak exposure;
- tool poisoning;
- unauthenticated local services;
- public network exposure;
- excessive tool permissions;
- unsafe skill manifests.

### Graph Adversarial Learning and DeepRobust

SCOPE-D uses graphs for attack paths, trust, policy, memory, and governance. Those graphs can be attacked.

Required robustness concerns:

- node injection;
- edge perturbation;
- graph poisoning;
- backdoor motifs;
- membership inference;
- model extraction;
- explanation manipulation;
- robustness drift across graph updates.

SCOPE-D should provide graph robustness assessments before we depend on graph-based AI for governance decisions.

### BEAR-C2 and similar offensive frameworks

Use only as adversary-emulation taxonomy and detection-validation inspiration. Do not import payloads, stagers, evasion logic, credential theft, persistence, log clearing, UAC bypass, or C2 execution code.

Allowed SCOPE-D outputs:

- adversary profile metadata;
- simulated observable catalog;
- ATT&CK technique mappings;
- expected telemetry;
- safe synthetic events;
- defensive detection tests.

Disallowed SCOPE-D outputs:

- deployable malware;
- C2 payloads;
- stealth or evasion implementation;
- unauthorized execution workflows;
- destructive operator automation.

## Target architecture

```text
SCOPE-D
├── agents/                         agent orchestration and analyst workflows
├── collectors/                     deterministic read-only collectors
├── detections/                     detection-as-code and countermeasure rules
├── exercises/                      purple-team exercise plans and atomic tests
├── intel/                          threat-intel feed adapters and indicator lifecycle
├── ai-infra/                       AI/MCP/agent-skill assessment modules
├── graph-robustness/               graph attack/defense evaluation harness
├── config/schemas/                 machine-readable contracts
├── dashboard/                      run evidence, attack graph, maturity, and coverage UX
└── docs/                           architecture, operating model, and safety doctrine
```

## Core contracts

SCOPE-D should define and validate these objects:

- `ControlLoopRun`
- `ControlGate`
- `EvidenceEnvelope`
- `AttackPathGraph`
- `PurpleTeamExercise`
- `EmulationPlan`
- `AtomicTestCase`
- `ThreatIntelFeed`
- `IndicatorRecord`
- `CountermeasureRule`
- `DetectionControl`
- `AIInfraAssessment`
- `MCPToolRisk`
- `AgentSkillRisk`
- `GraphRobustnessAssessment`
- `SafetyBoundary`
- `RunReceipt`

## Execution doctrine

SCOPE-D defaults to read-only collection and synthetic validation.

Any action that changes infrastructure, modifies identity, deploys code, executes exploit logic, runs payloads, contacts external services, mutates logs, changes policy, or writes to production systems requires an explicit gate and a policy decision.

Every run must produce:

- run directory;
- scoped target manifest;
- evidence envelopes;
- policy decisions;
- generated controls;
- validation results;
- report/dashboard artifact;
- signed or hashable run receipt.

## Integration with the SocioProphet / SourceOS estate

- SourceOS typed contracts define object shapes and validation.
- PolicyFabric governs capabilities, approvals, exceptions, and deployment gates.
- AgentPlane coordinates agents and subagents.
- SocioSphere visualizes posture, maturity, evidence, and control coverage.
- TurtleTerm / sourceos-shell / agent-term provide operator UX.
- openclaw supplies local model and agent runtime integration.
- memory-mesh stores only scoped, reviewed, redacted, tenant-safe knowledge.

## Immediate roadmap

1. Rebrand repository surface from upstream SCOPE to SCOPE-D while retaining attribution and license clarity.
2. Add schema contracts for the SCOPE-D control loop.
3. Add exercise and atomic-test manifest templates.
4. Add countermeasure rule packaging conventions.
5. Add AI infrastructure assessment module skeletons.
6. Add graph robustness assessment skeletons.
7. Add safe synthetic-event generation before any live test execution.
8. Add dashboard panels for exercise maturity, detection coverage, AI infra risk, and graph robustness.
