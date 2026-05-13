# Devine Intelligence Wargames — Topics 12–23 Operations Book

Status: v0.1 canonical expansion  
Owner plane: SCOPE-D / Devine Intelligence Wargames operations  
Scope: Topics 12 through 23  
Boundary: cyber defense, lab-safe validation, evidence-gated engagement, Michael-only signoff for elevated engagement until delegated policy exists

## Purpose

This document captures the operational expansion for Wargames Topics 12–23. It aligns training phases V1–V7, the canonical 10-agent corps, alpha-bound safety, FPGL control, Octonion boundary checks, FROST promotion, dynamic engagement approval, and proof requirements.

This document supersedes earlier fragmented topic expansions for Topics 12–23.

## Shared rules

All topics in this document inherit the global Wargames rules:

- SCOPE-D Wargames is a cyber defense system.
- Authorized defensive correlation is permitted inside approved scope.
- Identity-prime constraints govern disclosure, publication, learning reuse, and BridgeMode; they do not block authorized cyber defense correlation.
- DEFENSE mode produces operational evidence, findings, proofs, controls, and response posture.
- LEARNING mode produces redacted corpora, LSA/LSI/LDA maps, reproducibility checks, grammar tests, and pedagogy outputs.
- Elevated engagement E4/E5/E6 requires explicit Michael Heller signoff until a delegated policy exists.
- Any outside-boundary response must proceed only through lawful, evidence-backed, authorized coordination channels.
- No live exploit, credential theft, destructive automation, or unauthorized third-party action belongs in this repo.

## Topic 12 — Egress Economy / VI Allocator

### Objective

Converge to fair, explainable bandwidth and packet budgets without brittle throttles. Make egress tradeoffs measurable, auditable, and reversible.

### Phase map

- V1 Observe: Scout captures baseline rates, burstiness, backlog, and flow shape. Whisper inventories egress paths.
- V2 Profile: Fit producer, transporter, and consumer tuples. Veil checks for token or sensitive-field leakage in headers.
- V3 Cloak / Guard: Whisper enforces padding, MTU buckets, and egress discipline. Warden adds policy controls. Scribe pins parameters.
- V4 Swap / Stress: Shade simulates safe beacon-shape families under alpha bounds. Herald schedules contention epochs.
- V5 Align: FPGL ALIGN applies price and penalty adjustments. VI converges. Scribe records deltas.
- V6 Train: Detector thresholds ingest Omega multiplied by backlog and contention context.
- V7 Seal: Preceptor gate and FROST promotion. Bridge-Steward becomes eligible only if gates are green.

### Agent choreography

Scout -> Whisper -> Warden -> Herald -> Scribe. Veil runs continuously.

### Metrics and gates

- P95 backlog below 0.6 times capacity.
- Stall ratio below 3 percent.
- Omega-high beacons no more than baseline plus 5 percent.
- Header duplicates equal zero.
- CSP/WAF violations equal zero.
- Dead-band required between Omega scoring and VI adjustment to avoid oscillation.

### Runbook

1. Load `orchestrator/vi.yaml`.
2. Set capacity and penalty from V2 profile.
3. Start contention drill with 15-minute epoch.
4. Apply seeded random-phase cadence.
5. Apply FPGL ALIGN when Omega-high and backlog rise together.
6. Seal baseline and adjustment delta.

### Proofs

- `vi.alloc.baseline.json`
- `vi.adjustment.delta.json`
- `egress_economy.report.json`

### Failure modes

- Over-penalization causing starvation.
- Mis-bucketed MTU inflating loss or latency.
- Feedback oscillation between beacon score and allocator.
- Under-scoped evidence leading to false confidence.

### Upgrade path

- Add safe-explore bandit tuning with explicit alpha budget.
- Expose VI state over triRPC.
- Add per-surface fairness dashboards.

## Topic 13 — HPST Tomography and Agent Grading

### Objective

Detect overconfidence, drift, archetype mixing, weak grounding, poor abstention, and tool misuse. Keep agents calibrated and humble.

### Phase map

- V1 Observe: Collect calibration and evidence-quality buckets.
- V2 Profile: Compute tomography vector and z-like drift features.
- V3 Guard: Warden enforces abstention or review when risk score exceeds threshold.
- V4 Challenge: Use bounded, safe adversarial question sets and synthetic cases.
- V5 Align: Adjust thresholds and rubrics.
- V6 Train: Re-grade and compare drift.
- V7 Seal: Scribe seals scorecards and promotion evidence.

### Agent choreography

EvalAngelica leads. Scribe records. Warden enforces abstention. Herald schedules. Scout samples ground truth.

### Metrics and gates

- Expected calibration error at or below 0.04.
- Abstention in guardrail cases between 1 and 5 percent unless policy requires more.
- Drift below 0.5 sigma per epoch.
- Human audit sprint scheduled for high-impact model changes.

### Runbook

1. Generate multi-bin, multi-surface quizzes.
2. Record correctness, grounding, tool use, and abstention.
3. Compute tomography vector.
4. Update per-agent gradecards.
5. Route overconfident agents to reduced authority.

### Proofs

- `hpst.scorecard.json`
- `agent_dossier.jsonl`
- `evaluation.proof.json`

### Failure modes

- False humility and excessive abstention.
- Mis-grounded references.
- Probe leakage.
- Evaluator overfitting.

### Upgrade path

- Add conformal risk control under alpha bounds.
- Rotate probes.
- Add small-data reliability tests.

## Topic 14 — Two-Witness FROST Knowledge Promotion

### Objective

Canonize claims only under quorum, preserve dissent, and prevent solo-hero promotion.

### Phase map

- V1 Observe: Collect candidate claims.
- V2 Profile: Attach evidence refs and coverage map.
- V3 Partial: Collect witness partials.
- V4 Aggregate: Aggregate signature or record denial.
- V5 Publish Route: Draft release path and redaction state.
- V6 Appeal: Open appeal or revocation window.
- V7 Seal: Promote to ledger with signed proof.

### Agent choreography

Scribe leads. Herald manages ballot cadence. Warden checks policy. Bridge-Steward publishes only when gates are green.

### Metrics and gates

- Witness diversity from at least two independent domains where policy requires.
- Claim coverage map present.
- Redactions logged.
- Appeal and revocation path declared.
- Michael Heller signoff required where promotion changes authority, client disclosure, BridgeMode, or dynamic engagement scope.

### Runbook

1. Create `claim.json`.
2. Attach evidence refs and redaction state.
3. Collect witness partials.
4. Aggregate or deny.
5. Link provenance.
6. Render report where appropriate.
7. Seal promotion or retain as candidate.

### Proofs

- `claim.promoted.json`
- `frost.attest.json`
- signed report hashes

### Failure modes

- Partial replay.
- Stale evidence.
- Quorum friction in urgent cases.
- Insufficient dissent capture.

### Upgrade path

- Time-lock revocation window.
- Merkle inclusion proofs.
- Emergency lane with 24-hour retrospective quorum and Michael approval.

## Topic 15 — CI Drift Guard and SPEC Control

### Objective

Ensure production and staged configurations match Genesys/SPEC expectations. Drift must not sneak in.

### Phase map

- V1 Observe: Establish baseline.
- V2 Profile: Define protected path scope.
- V3 Gate: Enforce PR drift check.
- V4 Chaos Diff: Test intentional drift in lab.
- V5 Align: Manage exceptions and expiry.
- V6 Release: Bind release tag.
- V7 Freeze: Freeze on mismatch.

### Agent choreography

Scribe owns SPEC. Warden owns CI policy. Herald owns release cadence. Veil runs secret scans.

### Metrics and gates

- Delta SHA equals zero for protected paths.
- Exceptions expire within 14 days by default.
- SBOM present for release.
- Drift findings require owner and remediation path.

### Runbook

1. Pre-merge action compares SHAs against SPEC.
2. Block mismatch.
3. Auto-open repin or remediation task.
4. Require explicit exception with expiry when necessary.

### Proofs

- `spec.baseline.json`
- `drift.findings.json`
- `release.attest.json`

### Failure modes

- Hash over-coverage blocking hotfixes.
- Under-coverage allowing sensitive drift.
- Exception sprawl.

### Upgrade path

- Partition pins by criticality tier.
- Add in-toto attestations.
- Move toward SLSA v3-style provenance.

## Topic 16 — PQC Posture and Key Custody

### Objective

Future-proof cryptographic posture and bind secrets to measured state without disrupting defensive operations.

### Phase map

- V1 Inventory: Inventory key and algorithm posture.
- V2 Hybrid: Introduce hybrid KEM posture where appropriate.
- V3 Enforce: Enforce module signing and custody constraints.
- V4 Drill: Run break-glass and recovery drills.
- V5 Rotate: Rotate keys.
- V6 Revoke: Test revocation.
- V7 Seal: Seal inventory.

### Agent choreography

Warden owns boot/custody policy. Scribe records key state. Herald schedules rotations. Bridge-Steward handles commons key policy when relevant.

### Metrics and gates

- Hybrid coverage target at or above 90 percent where applicable.
- Unsealed secrets equal zero.
- Key age policy met.
- Recovery path tested.

### Runbook

1. Inventory KEM/signature posture.
2. Enroll measured boot where applicable.
3. Move sensitive access to hardware-backed or policy-gated keys.
4. Sign artifacts with current approved signatures.
5. Record rotation and revocation.

### Proofs

- `pqc.inventory.json`
- `rotation.log`
- `keycustody.proof.json`

### Failure modes

- Measured-state drift trapping unlock.
- Resident key loss.
- Client compatibility failures.

### Upgrade path

- Add remote attestation quotes in CI.
- Add post-quantum fallback documentation.
- Collect client-side compatibility telemetry.

## Topic 17 — Attestation and Measured Boot Pipeline

### Objective

Ensure only known-good sensors and defensive components run, visibly and auditably.

### Phase map

- V1 Observe: Map PCRs and boot state.
- V2 Profile: Verify UKI and policy hashes.
- V3 Guard: Enforce module-signing posture.
- V4 Simulation: Use benign measured-state drift scenarios in lab.
- V5 Align: Pin policies and hash expectations.
- V6 Recovery: Test recovery path.
- V7 Seal: Publish visible boot report.

### Agent choreography

Warden leads. Scout collects. Scribe seals. Herald schedules.

### Metrics and gates

- Quote freshness at or below 24 hours unless stricter policy applies.
- Unexpected module-load denials equal zero after baseline.
- Recovery MTTD below 60 seconds in drills.

### Runbook

1. Export PCRs.
2. Compare against SPEC.
3. Verify signed boot artifacts.
4. Exercise recovery in lab.
5. Seal attestation report.

### Proofs

- `boot.attest.json`
- `attest.chain.json`
- `visible_boot.report.json`

### Failure modes

- Firmware regression.
- Time skew.
- Over-strict PCR matching.

### Upgrade path

- Add DICE-style layering.
- Add remote policy hash notarization.

## Topic 18 — Publishing and Provenance

### Objective

Produce signed, reproducible reports with traceable sources. Truth stays portable.

### Phase map

- V1 Normalize: Normalize Markdown and source notes.
- V2 Convert: Convert through djot / Markdown pipeline.
- V3 Render: Render deterministic reports.
- V4 Seal: Apply signatures and hash banners.
- V5 Link: Attach provenance graph.
- V6 Balance: Tune density and readability.
- V7 Publish: Publish approved packet.

### Agent choreography

Scribe owns pipeline. EvalAngelica checks readability. Veil scrubs sensitive data.

### Metrics and gates

- Provenance links resolve.
- Hash stored.
- Readability within target band.
- Public/client-facing outputs obey OFIF and disclosure policy.

### Runbook

1. Normalize source.
2. Render deterministic report.
3. Embed proofs.
4. Hash and sign.
5. Attach provenance.
6. Publish only through approved route.

### Proofs

- `report.pdf.sha256`
- `provenance.json`
- `doc.proof.json`

### Failure modes

- Broken anchors.
- Density too high.
- Leaked sensitive material.
- Missing signatures.

### Upgrade path

- Add templated reports per topic.
- Add multi-locale plates.
- Add OFIF assurance packet export.

## Topic 19 — Ontology / Epi-Onto-Learning / AtomSpace / SHACL

### Objective

Define precise types and constraints for agents, flows, evidence, policies, claims, and controls.

### Phase map

- V1 Draft: Draft type tree.
- V2 Shape: Create SHACL shape.
- V3 Map: Map to ontology/AtomSpace where appropriate.
- V4 Conflict: Test edge cases and conflicts.
- V5 Align: Normalize names and anchors.
- V6 Validate: Run validation and triage violations.
- V7 Seal: Seal ontology bundle.

### Agent choreography

Scribe owns schema. Herald manages changes. Warden enforces. Scout samples evidence.

### Metrics and gates

- Violations equal zero for promoted artifacts.
- Coverage at or above 95 percent.
- Conflict proofs exist for intended ambiguity.

### Runbook

1. Generate shapes from Wargames fields.
2. Map to ontology classes.
3. Validate sample bundles.
4. Seal validated bundle.

### Proofs

- `types.sealed.ttl`
- `shacl.report.json`
- `ontology.proof.json`

### Failure modes

- Over-tight constraints.
- Schema drift.
- Unbounded extension fields.

### Upgrade path

- Add Tree-sitter grammars for policy and evidence dialects.
- Route semantic promotion through Ontogenesis.

## Topic 20 — Graph / Topo Forensics

### Objective

Preserve higher-order relations under noise and keep explanations legible.

### Phase map

- V1 Extract: Extract simplices and graph structures from boundary events.
- V2 Profile: Build boundary operators and graph fingerprints.
- V3 Kernel: Compute WL-like kernels or equivalent graph summaries.
- V4 Persistence: Compute persistent features.
- V5 Align: Tune thresholds to forensic standards.
- V6 Detect: Run community and motif detection.
- V7 Exhibit: Seal court-grade or audit-grade exhibits.

### Agent choreography

Scout builds graphs. Scribe records exhibits. Herald schedules epochs. EvalAngelica checks explainability.

### Metrics and gates

- Motif stability at or above 0.9 across subsamples.
- Bridge edges annotated.
- Explanation note attached to high-impact graph findings.

### Runbook

1. Build graph or simplicial complex from boundary events.
2. Compute stable features.
3. Compare across epochs.
4. Select persistent motifs.
5. Seal exhibit.

### Proofs

- `topo.case.pdf`
- `motif.index.json`
- `topo.persistence.json`

### Failure modes

- Motif overfitting.
- Missing hyperedges.
- Explanation sprawl.

### Upgrade path

- Add sheaf-style coherence checks for multi-surface evidence.
- Add MeshRush graph-view export.

## Topic 21 — Generative Search / GFlowNets

### Objective

Sample diverse high-reward defensive hypotheses without mode collapse and without unsafe exploration.

### Phase map

- V1 Reward: Define reward shape.
- V2 Balance: Define flow balance and constraints.
- V3 Coverage: Measure coverage.
- V4 Novelty: Add novelty constraints.
- V5 Align: Tune guardrails.
- V6 Archive: Archive best hypotheses.
- V7 Publish: Publish only proof-backed, safe hypotheses.

### Agent choreography

EvalAngelica seeds and evaluates. Scribe archives. Warden checks safety. Herald schedules sampling cadence.

### Metrics and gates

- Coverage at or above 0.8 on declared latent map.
- Safety guard violations equal zero.
- Novelty bounded by policy and alpha constraints.

### Runbook

1. Seed with LSA anchors.
2. Constrain with ontology and policy.
3. Generate candidate hypotheses.
4. Accept only proof-backed, safe, explainable outputs.

### Proofs

- `gfn.samples.json`
- `hypotheses.proof.json`

### Failure modes

- Degenerate paths.
- Unsafe hypotheses.
- Local cycles.

### Upgrade path

- Add tempered posterior mixing under safe temperature limits.
- Integrate CRC thresholds as promotion gates.

## Topic 22 — Quantum-Inspired Toolkits

### Objective

Use variational and structure-preserving optimization ideas safely, without overclaiming quantum advantage.

### Phase map

- V1 Choose: Choose ansatz or surrogate.
- V2 Loop: Run bounded variational loop.
- V3 Check: Add shadow / QMC sanity checks where appropriate.
- V4 Error: Attach error bars.
- V5 Align: Tune anneal schedule.
- V6 Certify: Certify relaxations.
- V7 Teach: Produce pedagogy pack.

### Agent choreography

Herald schedules loops. Scribe records error accounting. EvalAngelica creates teaching aids.

### Metrics and gates

- Loss landscape smoothness noted.
- Certification notes attached.
- Reproducibility verified with fixed seeds.
- No claim of quantum advantage without evidence.

### Runbook

1. Use synthetic data.
2. Run small demos.
3. Compare to classical baselines.
4. Export didactic notebooks and proof notes.

### Proofs

- `nqs.demo.report.pdf`
- `variational.loss.json`
- `pedagogy.proof.json`

### Failure modes

- Overclaiming.
- Poor calibration.
- Opaque results.

### Upgrade path

- Map results to classical convex relaxations for sanity bounds.
- Publish side-by-side classical and variational comparisons.

## Topic 23 — DevEx and Editors

### Objective

Maintain deterministic editing, sealed plugin supply chains, safe autoscouts, and reproducible workspaces.

### Phase map

- V1 Lock: Inventory and lock plugins.
- V2 Profile: Measure LSP latency and workspace health.
- V3 Bridge: Establish triRPC bridge where appropriate.
- V4 Trigger: Test autoscout triggers.
- V5 Align: Normalize keymaps and policies.
- V6 Drill: Run crashproof and recovery drills.
- V7 Seal: Seal hermetic workspace.

### Agent choreography

Scribe locks. Herald schedules. Warden enforces policy. Veil handles secret hygiene.

### Metrics and gates

- Plugin SHAs pinned.
- LSP P95 below 80 milliseconds where applicable.
- Crash recovery below 5 seconds where applicable.
- No rogue plugin drift.

### Runbook

1. Generate lockfiles.
2. Pin plugin hashes.
3. Configure autoscout scanning with safe thresholds.
4. Block rogue plugins.
5. Seal workspace.

### Proofs

- `devex.hermetic.json`
- `workspace.lock.json`
- `plugin.sha.set`

### Failure modes

- Supply-chain drift.
- Excessive autoscout noise.
- Remote execution risk.

### Upgrade path

- Add editor-native FROST hooks for signed config changes.
- Add supply-chain diff display.

## Cross-topic edges

- Topic 12 Omega times backlog informs Topic 9 Omega band review.
- Topic 15 SHA drift informs Topic 18 provenance banners.
- Topic 16 key rotation informs Topic 17 attestation.
- Topic 19 SHACL violations become Topic 20 hyperedges.
- Topic 20 persistent motifs seed Topic 21 hypothesis exploration.
- Topic 21 safe novelty feeds Topic 22 pedagogy.
- Topic 23 plugin locks support Topic 18 publishing consistency.

## Minimal dashboards

- VI / Omega panel: backlog, price, Omega bands, MTU buckets.
- Tomography panel: ECE, drift, abstention windows.
- Attestation panel: PCR deltas, boot signatures, module-signing state.
- Provenance panel: claims, FROST ballots, hash banners.
- OFIF field panel: client-visible summaries, confidence, redaction state, authorization refs.
- Engagement panel: E0–E6 level, trigger, proof refs, Michael approval status where required.

## Self-critique and refinements

1. Topic 12 and Topic 9 coupling needs dead-band to avoid oscillation.
2. Topic 13 requires trustworthy ground truth and recurring human audits.
3. Topic 14 needs an emergency lane with retrospective quorum and Michael approval.
4. Topic 15 hash scope must be tiered to avoid blocking urgent fixes.
5. Topic 16 and 17 need compatibility fallback documentation.
6. Topic 18 density tuning should be tested against reader profiles.
7. Topic 19 ontology drift requires time-boxed alias maps.
8. Topic 20 should prefer persistent features before high-stakes use.
9. Topic 21 guardrails must be testable, not aspirational.
10. Topic 22 must avoid unproven quantum-advantage claims.
11. Topic 23 autoscout alerts should route to Herald only on meaningful cross-threshold signals.

## Completion definition

This document becomes implementation-backed only when each topic has schema-backed examples, validation, proof/receipt shapes, and dashboard representation. Until then, it is a canonical operational capture, not an implemented runtime.
