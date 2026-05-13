# Devine Intelligence Wargames Mode Switch

Status: v0.1 capture baseline  
Owner plane: SCOPE-D defensive exercises, learning loops, and dashboard semantics  
Canonical modes: `DEFENSE` and `LEARNING`

## Purpose

The Devine Intelligence Wargames architecture has one 23-topic scaffold and two operating modes.

- `DEFENSE`: cyber games, blue/red lab validation, posture stress tests, detection and response measurement, guardrail hardening.
- `LEARNING`: knowledge and pedagogy mode, where the same exercises become structured corpora for LSA/LSI/LDA learning, reproducibility, grammar growth, and operator training.

The same topics, agents, proofs, and gates apply in both modes. The mode flag changes outputs, dashboards, rubrics, and downstream routing. It does not weaken safety controls.

## Shared spine

Always on:

- alpha-bound safety;
- Octonion boundary checks;
- FPGL gates: ACCUM, ALIGN, LIMIT;
- signed ProofArtifacts;
- human quorum and FROST promotion where canonization or bridge diffusion is involved;
- no live exploitation;
- no impersonation;
- no credential harvesting;
- lab-scoped synthetic adversarial shapes only;
- reversible promotion and rollback posture.

## Mode flag

Every exercise, profile, proof pack, and dashboard run should declare a mode.

```yaml
wargames:
  mode: DEFENSE # DEFENSE | LEARNING
  topicRefs: [1, 9, 12, 14, 19, 20, 23]
  safety:
    syntheticOnly: true
    livePayloadsAllowed: false
    credentialCollectionAllowed: false
  outputs:
    proofs: true
    learningCorpus: true
    dashboardProfile: defense
```

Mode validation rules:

- `DEFENSE` requires operational KPIs and promotion gates.
- `LEARNING` requires pedagogical rubrics and reproducibility checks.
- Both modes require redaction state, evidence refs, proof refs, and safety-boundary refs.

## Topic-mode split

| Topic | DEFENSE lens | LEARNING lens |
|---|---|---|
| 1. GIE rollout | Drill seed to lab to perimeter; prove immutability; gate promotions. | Teach provenance chains, attestations, hashes, and reproducible handoff. |
| 2. Android VM / nano-C2 | Run synthetic beacon/exfil shapes; measure Omega bands, false positives, false negatives. | Build feature intuition: jitter, padding, ALPN, QUIC, DoH as LSA dimensions. |
| 3. Reverse-tether | Validate prod bans for ADB/relay patterns; confirm detection and alerts. | Explain host/guest ambiguity and why policy beats guesswork. |
| 7. Virtual display / PipeWire | Expose hidden screens, virtual displays, and screencast risks; trigger guardrails. | Teach device/portal taxonomy; EDID and PipeWire nodes as stable anchors. |
| 9. Header typing / Omega scoring | Score flows without payloads; tune thresholds with safe swaps. | Show why scores fire: periodicity, header minimality, ALPN family, JA3 stability. |
| 12. Egress economy / VI | Prove fair budgets under contention; avoid brittle throttles. | Visualize value iteration and resource allocation as control learning. |
| 14. FROST promotion | Stop solo-hero canonization; require two-witness promotion. | Practice evidence to claim to quorum as a learning ritual. |
| 19. Ontology / SHACL / Tree-sitter | Enforce types for agents, flows, evidence, controls, and claims. | Grow the language through intuitive LR(1)-friendly grammar and SHACL exercises. |
| 20. Topo forensics | Preserve higher-order relations under noise; support forensic graph explanations. | Teach motifs, persistence, kernels, and why topology resists adversarial noise. |
| 23. DevEx / editors | Seal toolchains, plugins, autoscout triggers, and workspace reproducibility. | Teach deterministic editing, proof checklists, and reproducible research discipline. |

The table above is not exclusive. All 23 topics support both modes; these ten are the control topics where the mode distinction is most visible.

## DEFENSE outputs

DEFENSE mode tracks operational outcomes:

- MTTD;
- MTTR;
- coverage percentage;
- false-positive debt;
- false-negative debt;
- kill-switch latency;
- rollback integrity;
- policy violations;
- detector AUROC;
- Omega-band distribution;
- proof-pack completeness.

Typical DEFENSE artifacts:

- `*.proof.json`;
- `policy.pack.json`;
- `cloak.proof.json`;
- `swap.adversarial.proof.json`;
- `halt.report.json`;
- `promotion.pack.json`;
- Warden LIMIT receipts;
- Herald phase ledgers;
- Scribe signed reports.

## LEARNING outputs

LEARNING mode tracks understanding and reproducibility:

- LSA topic coherence;
- LSI anchor stability across p2..p31;
- LDA emergence quality;
- grammar coverage;
- parser corpus pass rate;
- SHACL pass rate;
- reproducibility score;
- notebook determinism;
- operator comprehension rubrics;
- lesson-learned closure.

Typical LEARNING artifacts:

- notebooks;
- annotated corpora;
- Tree-sitter parser tests;
- SHACL validation reports;
- didactic plots;
- topic heatmaps;
- LSA/LSI/LDA maps;
- learning release packs.

## Agent functions by mode

| Agent | DEFENSE function | LEARNING function |
|---|---|---|
| Scout | Telemetry coverage, passive observation, Omega feature extraction. | Feature intuition, corpus capture, topic labeling. |
| Whisper | Egress minimization, header discipline, DoH/DoT and ALPN/J A3 controls. | Teach how egress design affects observability and privacy. |
| Warden | Guardrails, policy enforcement, LIMIT, rollback. | Teach policy-as-code and gate reasoning. |
| Shade | Synthetic beacon and exfil-shape generation for detector training. | Safe exemplars for feature-space learning. |
| Sapper-Sim | Benign delivery and response-chain drills. | Safe failure examples and rollback pedagogy. |
| EvalAngelica | Promotion scoring, resonance scan, diffusion readiness. | Understanding gaps, rubrics, topic coherence. |
| Scribe | Proofs, ledgers, signed reports. | Reproducible research discipline and provenance literacy. |
| Herald | Phase orchestration, cadence, ballots. | Seminar loop orchestration and release cadence. |
| Veil | Privacy, DLP, TLI/RWI, redaction. | Teaches counts-not-content and responsible measurement. |
| Bridge-Steward | Controlled Topic-23 proof-leaf diffusion. | Publishes reviewed lessons and cross-pollinates anchors. |

## Bidirectional trace

DEFENSE runs produce labeled corpora. LEARNING refines detectors, policies, grammars, and operator playbooks.

Required trace fields:

```yaml
trace:
  defenseRunRef: scope-d-run:<id>
  learningCorpusRef: corpus:<id>
  topicRefs: []
  lsaDims: []
  lsiAnchors: []
  detectorRefs: []
  policyRefs: []
  proofRefs: []
  lessonsLearnedRefs: []
```

Promotion rule: A DEFENSE result should not become canon without either an attached proof pack or a LEARNING-mode explanation pack. A LEARNING artifact should not update a live detector or policy without a DEFENSE-mode validation run.

## Dashboard semantics

A dashboard must flip KPIs by mode while preserving the same topic spine.

DEFENSE dashboard:

- surface coverage;
- Omega bands;
- active HALTs;
- policy pack state;
- detector regression;
- MTTD / MTTR;
- rollback receipts.

LEARNING dashboard:

- topic coherence;
- anchor stability;
- grammar pass rate;
- SHACL pass rate;
- notebook reproducibility;
- lesson closure;
- release readiness.

Shared dashboard:

- phase V1..V7;
- surfaces H1..H7;
- proof status;
- safety gates;
- TLI/RWI;
- FROST quorum state;
- BridgeMode eligibility.

## Implementation backlog

1. Add `mode` to exercise manifests and control-loop examples.
2. Add `WargamesMode` enum to future exercise schema: `DEFENSE | LEARNING`.
3. Add dashboard profile switch: `defense`, `learning`, `shared`.
4. Add bidirectional trace refs between defense runs and learning corpora.
5. Add CI validation: mode-specific required fields must be present.
6. Add example manifests for one DEFENSE run and one LEARNING run using the same topic set.

## Safety boundary

Mode switching cannot be used to bypass controls. `LEARNING` mode may explain offensive concepts only as bounded taxonomy, detection validation, or synthetic-shape pedagogy. It may not generate deployable malware, exploit payloads, stealth logic, credential theft workflows, or unauthorized execution plans.

## Completion definition

The mode layer is complete when a single Wargames run can emit both a DEFENSE proof pack and a LEARNING corpus pack, with explicit cross-references, stable LSA/LSI anchors, and safety validation in CI.
