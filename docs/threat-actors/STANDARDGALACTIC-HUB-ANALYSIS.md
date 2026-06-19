# standardgalactic: Hub Analysis
**Date:** 2026-06-19
**Companion:** `docs/threat-actors/STANDARDGALACTIC.md`
**Status:** LIVE — SG follower crawl 3,100/25,540 profiled (12%)

---

## The hub model

standardgalactic is not just a threat actor — it is a **distribution hub** for tools,
methodology, and network access used by a community of ~22,500 followers. Treating SG as a
single actor misses the point. The followers are the amplification layer.

## Follower community profile (3,100 profiled of 25,540)

| Metric | Value |
|---|---|
| Security-flagged | **209** (6.0% of profiled — 10-20x GitHub baseline) |
| Notable (500+ followers) | 241 |
| Overlap with our 1-hop | 2 (0 also security-flagged) |

### Influence tier breakdown

| Tier | Count |
|---|---|
| whale (10K+) | 0 |
| influencer (1K-10K) | 19 |
| active (100-1K) | 249 |
| small (<100) | 2783 |
| none/unknown | 49 |

### Interest clusters (top 10 of profiled)

| Category | Count |
|---|---|
| Other/Uncategorized | 1440 |
| Platform | 842 |
| AI/ML | 746 |
| Web/Frontend | 643 |
| DevTools/CLI | 489 |
| Data/ML-Ops | 422 |
| Cloud | 395 |
| Linux | 333 |
| Security | 168 |

## Active tool users

These accounts have starred or forked SG's operational tools — they are not passive observers:

| Login | Tools | In our network | Note |
|---|---|---|---|
| [divinecmarie-jpg](https://github.com/divinecmarie-jpg) | agent_hivemind, system_prompts |  |  |
| [EngReteti](https://github.com/EngReteti) | SeeRepo | 2-hop |  |
| [Steake](https://github.com/Steake) | SeeRepo | 2-hop |  |
| [TheredoneShoegaze](https://github.com/TheredoneShoegaze) | brain_star |  |  |
| [deltaRed1a](https://github.com/deltaRed1a) | brain_star |  |  |
| [SarahLyford](https://github.com/SarahLyford) | brain_star |  |  |
| [alifzl](https://github.com/alifzl) | brain_star |  |  |
| [vittorioPiotti](https://github.com/vittorioPiotti) | brain_star | 2-hop |  |
| [KostasSliazas](https://github.com/KostasSliazas) | brain_star | 2-hop |  |
| [durango](https://github.com/durango) | brain_star |  |  |
| [yonghun16](https://github.com/yonghun16) | brain_star |  |  |
| [Raghav454](https://github.com/Raghav454) | brain_star |  |  |
| [bcExpt1123](https://github.com/bcExpt1123) | brain_star | 2-hop |  |
| [ten13nt3d](https://github.com/ten13nt3d) | brain_star |  |  |
| [BJW333](https://github.com/BJW333) | brain_star |  |  |
| [abullais123](https://github.com/abullais123) | brain_star |  |  |
| [Enderfarmer](https://github.com/Enderfarmer) | brain_star |  |  |
| [ismaildanado](https://github.com/ismaildanado) | brain_star |  |  |
| [Aznaggar](https://github.com/Aznaggar) | brain_star |  |  |
| [7-5](https://github.com/7-5) | brain_star |  |  |
| [aceapeking32](https://github.com/aceapeking32) | brain_star |  |  |
| [lacrm29](https://github.com/lacrm29) | brain_fork, brain_star |  |  |
| [MolarFox](https://github.com/MolarFox) | brain_star |  |  |
| [IpawnprozNetwork](https://github.com/IpawnprozNetwork) | brain_star |  |  |
| [regtoua12-oss](https://github.com/regtoua12-oss) | brain_star |  |  |
| [CareerLow](https://github.com/CareerLow) | brain_star | 2-hop |  |
| [dkapt](https://github.com/dkapt) | brain_star | 2-hop |  |
| [Tboy1989](https://github.com/Tboy1989) | brain_star |  |  |
| [Abraxas2506](https://github.com/Abraxas2506) | brain_star |  | NAMED AFTER SG REPO |
| [Ari4ka](https://github.com/Ari4ka) | brain_star | 2-hop |  |
| [Sarverott](https://github.com/Sarverott) | brain_star | 2-hop |  |
| [js-bruno](https://github.com/js-bruno) | brain_star |  |  |
| [dracoloveforall-crypto](https://github.com/dracoloveforall-crypto) | brain_star | following |  |
| [IzuAbe](https://github.com/IzuAbe) | brain_fork, brain_star | 2-hop |  |
| [Babkock](https://github.com/Babkock) | brain_star |  |  |
| [42hgyn26hz-cpu](https://github.com/42hgyn26hz-cpu) | system_prompts |  |  |
| [1995F150](https://github.com/1995F150) | system_prompts |  |  |
| [raufjafarov](https://github.com/raufjafarov) | system_prompts |  |  |
| [supervnova](https://github.com/supervnova) | system_prompts |  |  |
| [umidjon3455](https://github.com/umidjon3455) | system_prompts | 2-hop |  |
| [mija4264-arch38](https://github.com/mija4264-arch38) | brain_fork |  |  |
| [cezary13k](https://github.com/cezary13k) | brain_fork |  |  |
| [vincentnderitu](https://github.com/vincentnderitu) | brain_fork |  |  |
| [ImDashy](https://github.com/ImDashy) | brain_fork |  |  |
| [machackabook](https://github.com/machackabook) | brain_fork | 2-hop |  |
| [AlnetharyT](https://github.com/AlnetharyT) | brain_fork |  |  |
| [RainbowScientist5](https://github.com/RainbowScientist5) | brain_fork |  |  |
| [1Crazymoney](https://github.com/1Crazymoney) | brain_fork | 2-hop |  |

## Key tool → risk mapping

| Tool | Stars/Forks | Risk |
|---|---|---|
| `brain` | 32⭐ / 10 forks | Obfuscated ops framework. Active fork community. |
| `system-prompts-and-models-of-ai-tools` | 6⭐ | AI capability intelligence. Users are harvesting Claude Code, Cursor, Devin system prompts. |
| `SeeRepo` | 2⭐ | AST codebase exploit graph. Created June 15 — very new, still gathering users. |
| `agent-hivemind` (ClaudeOps) | 1⭐ | MCP C2 infrastructure. `divinecmarie-jpg` is the only known user — also starred system-prompts. |

## `divinecmarie-jpg` — elevated concern

This account starred both `system-prompts-and-models-of-ai-tools` AND `agent-hivemind` (ClaudeOps).
That combination — AI intel collection + C2 MCP — suggests active operational interest, not passive
research. Account is an SG follower.

## `dracoloveforall-crypto` — in our direct network

This account is in our **following** list (we follow them) and starred SG's `brain` repo.
That makes them a bridge between our network and SG's tool ecosystem. Worth reviewing.

## `Abraxas2506` — naming signal

Username matches SG's `abraxas` repo ("Hapax Perplexus", Gnostic cipher). Starred `brain`.
Could be coincidence or a coordination/affiliation signal.

## Risk summary

SG's community represents a **distributed tool-sharing network** for:
1. Codebase static analysis and exploit research (SeeRepo)
2. AI system intelligence collection (system-prompts)
3. MCP ecosystem infiltration (agent-hivemind/ClaudeOps)
4. Obfuscated operational frameworks (brain/obfuscarium)

The security professional density (6.0%) is anomalously high.
For comparison, a random GitHub sample yields ~0.5-1% security-keyword density in bios.
SG has attracted a concentrated community of people who work in offensive/defensive security,
AI research, and adjacent fields — and who actively use SG's operational tools.

## SCOPE-D actions

- `ai-infra/mcp-risk/STANDARDGALACTIC-MCP.md` — MCP server threat assessment
- `intel/github/` — live crawl infrastructure for ongoing monitoring
- Monitor `standardgalactic/SeeRepo` for new releases and new stargazers as it matures
- Add `divinecmarie-jpg` and `dracoloveforall-crypto` to watchlist
