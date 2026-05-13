# Devine Intelligence Wargames Capture Ledger

Status: v0.1 integration ledger  
Branch: `scope-d-di-war-games-alignment`  
Repository: `SocioProphet/SCOPE-D`  
Purpose: prevent loss, duplication, or drift while integrating the uploaded Wargames corpus into SCOPE-D.

## Canonical spelling

Use **Devine Intelligence Wargames** for the program name in this repo.

Do not canonicalize the misspelling `Argames`. Historical references may remain in user notes, but repo-facing documents should use Wargames.

## Integration status

| Source family | Integration status | Repo artifact |
|---|---:|---|
| Unified Wargames recap: GIE, LSA/LSI/LDA, 23 topics, agent corps, Memphis/FROST, TLI/RWI | captured | `docs/DIVINE_INTELLIGENCE_WAR_GAMES_ALIGNMENT.md` |
| DEFENSE / LEARNING dual-mode semantics | captured | `docs/WARGAMES_MODE_SWITCH.md` |
| Ghostspace Algebraic Symbolic Constructs / GASC | captured | `docs/GHOSTSPACE_GASC_ALIGNMENT.md` |
| Boundary-centric cyber hypergraph | pending detailed doc | `docs/BOUNDARY_CYBER_HYPERGRAPH_ALIGNMENT.md` |
| Agent roster: 10 core soldiers | pending detailed doc | `docs/WARGAMES_AGENT_ROSTERS.md` |
| Agent roster: 23 topical soldiers | pending detailed doc | `docs/WARGAMES_AGENT_ROSTERS.md` |
| Scout full spec | pending dedicated doc | `docs/agents/SCOUT_AGENT_SPEC.md` |
| Whisper v0.1 / v1.0 egress spec | pending dedicated doc | `docs/agents/WHISPER_AGENT_SPEC.md` |
| Font and rendering surface drill | pending dedicated doc | `docs/surfaces/FONT_RENDERING_SURFACE_DRILL.md` |
| Memphis Rite ceremony and purpose | partially captured; pending dedicated doc | `docs/MEMPHIS_RITE_GOVERNANCE.md` |
| Omissions and completions: Triune RPC, AUM, qlog, CI drift, CRDT, SHACL, HPST, symbolic bridges | partially captured; pending schema backlog | `docs/WARGAMES_IMPLEMENTATION_BACKLOG.md` |
| LSA/LSI 23-topic map and operationalization scripts | captured conceptually; pending machine map | `docs/WARGAMES_LSA_LSI_MAP.md` and later `examples/scope-d/wargames-lsa-map.example.json` |

## Capture principles

1. **One program, multiple layers.** The uploaded corpus contains theory, operating doctrine, schemas, runbooks, and code sketches. We keep them connected but do not collapse them into one monolithic file.
2. **Defensive-only posture.** Any wording around beacon, cloak, exfil shape, C2, dork, or adversarial drill is recast as defensive taxonomy, synthetic telemetry, detection validation, or lab-only pedagogy.
3. **Boundary-first evidence.** Boundary events, missing evidence, tamper signals, and proof artifacts become first-class objects.
4. **Mode-aware Wargames.** Each artifact must support `DEFENSE`, `LEARNING`, or both.
5. **No hidden authority.** Symbolic objects, GASC atoms, topic anchors, and agent roles never imply execution authority. Mutations require SCOPE-D gates.
6. **Stable prime anchors.** p2..p31 labels are durable references for LSI, dashboards, topic maps, and examples.
7. **Proof before promotion.** Anything moving toward canonization needs evidence refs, proof refs, redaction state, safety boundary, and quorum status.

## Immediate file plan

### Completed in this PR

- `docs/DIVINE_INTELLIGENCE_WAR_GAMES_ALIGNMENT.md`
- `docs/GHOSTSPACE_GASC_ALIGNMENT.md`
- `docs/WARGAMES_MODE_SWITCH.md`
- `docs/WARGAMES_CAPTURE_LEDGER.md`

### Next files in this branch

- `docs/BOUNDARY_CYBER_HYPERGRAPH_ALIGNMENT.md`
- `docs/WARGAMES_AGENT_ROSTERS.md`
- `docs/agents/SCOUT_AGENT_SPEC.md`
- `docs/agents/WHISPER_AGENT_SPEC.md`
- `docs/surfaces/FONT_RENDERING_SURFACE_DRILL.md`
- `docs/MEMPHIS_RITE_GOVERNANCE.md`
- `docs/WARGAMES_LSA_LSI_MAP.md`
- `docs/WARGAMES_IMPLEMENTATION_BACKLOG.md`

## De-duplication rules

Several uploaded documents repeat the same structures at different fidelity levels. We resolve as follows:

- Whisper v1.0 supersedes Whisper v0.1 for operational detail, while v0.1 remains useful for the clean conceptual state machine.
- The 10-agent roster is the canonical operational corps.
- The 23-agent roster is a topic-to-role overlay, not a replacement for the 10-agent corps.
- The 23-topic LSA/LSI map is the canonical topic spine.
- Topics 17–23 ops books are treated as detailed expansions of the canonical topic spine.
- The boundary hypergraph is the canonical evidence model for cross-boundary behavior and negative evidence.
- GASC is the canonical symbolic substrate for atoms and morphisms.
- Memphis Rite is the canonical promotion, halt, and bridge governance model.

## Safety rewording ledger

| Source phrase | Repo-safe interpretation |
|---|---|
| C2 / beacon / exfil | Synthetic telemetry shape for detector validation |
| Cloak | Egress minimization and explainable privacy-preserving discipline |
| Adversarial | Lab-only safe perturbation or synthetic stressor |
| Spy-vs-Spy | Bounded symmetric training exercise with proof-only output |
| Trojan / glyph | Lab-safe pedagogy carrier with no payload |
| Dork | Defensive exposure query against owned/authorized domains only |
| Death Rite | Simulated failure and rollback training |
| Bridge | Controlled proof-leaf diffusion after quorum and safety gates |

## Completion definition for this capture round

This capture round is complete when every uploaded source family has either:

- a dedicated SCOPE-D document;
- an explicit section in a larger canonical document;
- a schema/example backlog item;
- or a conscious deferral with reason.

No uploaded material should remain only in chat once this PR is finished.
