# SCOPE-D Operating Model

SCOPE-D is a defensive purple-team control fabric. It may model adversary behavior, but it defaults to read-only collection, synthetic validation, and dry-run execution. Live or mutating actions require explicit gates and policy decisions.

## Safe local workflow

Install dependencies and validate contracts:

```bash
npm install
npm test
```

Create a complete local synthetic run:

```bash
npm run scope-d:init
```

This creates `runs/<run-id>/` with:

- `target-manifest.json`
- `safety-boundary.json`
- `events.jsonl`
- `control-loop.json`
- `report.md`
- `receipt.json`

The initializer refuses production/customer environments, supports only the `synthetic_lab` surface for now, performs no live actions, uses no credentials, performs no network egress, and validates generated target-manifest, synthetic-event, control-loop, safety-boundary, and receipt artifacts before writing the final receipt.

Verify a generated run:

```bash
npm run scope-d:verify-run -- runs/<run-id>
```

The verifier checks required artifacts, AJV schemas, JSONL synthetic events, receipt artifact hashes, and cross-file consistency. If any file is modified after receipt creation, receipt hash verification fails.

Generate a verified run summary for SocioSphere / PolicyFabric handoff:

```bash
npm run scope-d:report-run -- runs/<run-id>
```

The reporter invokes the verifier first. It writes `run-summary.json` and `run-summary.md` only after verification succeeds. The JSON summary is validated against `run-summary.schema.json` and includes target metadata, safety posture, event/evidence/gate counts, receipt metadata, artifact hashes, and handoff readiness flags.

Export a verified run into Ontogenesis-compatible RDF/Turtle:

```bash
npm run scope-d:export-ontogenesis -- runs/<run-id>
```

The exporter invokes the verified reporter first. It writes `ontogenesis.ttl` using the Ontogenesis `apt:` agentic-purple-team vocabulary and MITRE alignment hooks. This gives SocioSphere, PolicyFabric, and Ontogenesis a semantic handoff artifact for the run.

Generate only a synthetic atomic observation from the safe example testcase:

```bash
npm run synthetic:event
```

This writes a JSONL event to `runs/synthetic-lab/events.jsonl`. Runtime output under `runs/`, `reports/`, and `receipts/` is ignored by Git.

## Safety layers

SCOPE-D uses multiple safety layers:

1. **Contract safety** — JSON Schemas encode allowed modes, gates, and required metadata.
2. **Example safety invariants** — examples must remain synthetic/read-only/dry-run.
3. **Boundary policy** — `SafetyBoundary` defines credential, command, network, memory, approval, and audit boundaries.
4. **Synthetic-first validation** — detection validation begins with synthetic telemetry, not live payload execution.
5. **Operator gates** — deployment, writes, credential access, and destructive actions require explicit gate decisions.
6. **Runtime receipts** — every run emits hashable artifacts and a run receipt.
7. **Receipt verification** — generated runs can be re-verified for schema correctness and tamper evidence.
8. **Verified reporting** — run summaries are generated only from verified runs.
9. **Semantic export** — Ontogenesis RDF is generated only from verified run summaries.

## Execution classes

| Class | Meaning | Default gate |
|---|---|---|
| `read` | Passive collection or local file inspection | none |
| `synthetic_event` | Generated telemetry with no live effect | none |
| `dry_run` | Non-mutating command or simulated execution | policy optional |
| `network_call` | Egress to external or target systems | human and/or policy |
| `write` | Any mutation of local or remote state | human and policy |
| `deployment` | Control, detection, policy, or infrastructure deployment | human and policy |
| `destructive_action` | Delete, disable, exploit, tamper, or degrade action | blocked by default |
| `credential_access` | Secret/token collection or use beyond scoped read-only context | blocked by default |
| `memory_write` | Persistence beyond session scope | human and policy with redaction |

## Reference-driven expansion

SCOPE-D absorbs safe lessons from external frameworks as follows:

- PTEF informs exercise design, roles, metrics, maturity, and lessons learned.
- Atomic Red Team informs reproducible, ATT&CK-mapped validation tests.
- GreedyBear and CIF-style systems inform threat-intel ingestion and indicator lifecycle.
- Mandiant countermeasure rules inform detection packaging and maturity states.
- AI-Infra-Guard informs AI runtime, MCP, tool, skill, and jailbreak-risk surfaces.
- Graph adversarial learning and DeepRobust inform graph robustness assessment.
- C2 simulation projects are only used for taxonomy, observables, and defensive emulation metadata; SCOPE-D does not import payloads or live offensive capability.

## Runtime artifact expectations

Each meaningful SCOPE-D run should produce:

- target manifest;
- safety boundary;
- evidence envelopes;
- control-loop run object;
- generated detections or controls, if any;
- validation results;
- report or dashboard artifact;
- run receipt;
- verified run summary when prepared for external handoff;
- Ontogenesis RDF export when prepared for semantic graph ingestion.

## Non-negotiables

- No live exploit payloads in default workflows.
- No credential collection in examples or synthetic flows.
- No public-network scanning from examples.
- No persistent memory writes without tenant scope, redaction, review, and gate decision.
- No control deployment without explicit operator and policy approval.
