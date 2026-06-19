# SG Network: TTP Map and High-Value Actor Inventory

**Date:** 2026-06-19  
**Source:** `intel/github/sg_repo_miner.py` — repos of 488 security-flagged SG followers  
**Status:** LIVE — 168/488 accounts mined (6,410 repos analyzed so far)  
**Companion:** `docs/threat-actors/STANDARDGALACTIC.md`, `STANDARDGALACTIC-HUB-ANALYSIS.md`

---

## TTP prevalence across SG security community

### Offensive capabilities (accounts with each TTP)

| TTP | Accounts | Notes |
|---|---|---|
| `web_vuln` | 102 | SQLi, XSS, RCE, LFI, SSRF — most common; broad web attack tooling |
| `credential_attack` | 40 | Password crackers, brute-force, hashcat |
| `network_scan` | 27 | Port scanners, nmap wrappers, network enumeration |
| `exploit_dev` | 24 | Exploit frameworks, PoC repos, CVE tooling |
| `recon_osint` | 23 | Shodan, enumeration, footprinting |
| `c2_implant` | 19 | Command-and-control frameworks, beacons, RATs |
| `fuzzing` | 15 | AFL, honggfuzz, coverage-guided fuzzers |
| `malware` | 14 | Malware samples, analysis, development |
| `ransomware` | 11 | Ransomware builders, samples, analysis |
| `evasion` | 10 | AV/EDR bypass, AMSI bypass, obfuscation |
| `phishing` | 9 | Phishing kits, GoPhish configs, credential harvesting |
| `ai_attack` | 6 | Prompt injection, jailbreak, LLM manipulation — **growing vector** |
| `rootkit` | 3 | Kernel-level persistence |
| `exfiltration` | 2 | Data theft tooling |
| `privesc` | 2 | Local privilege escalation |

### Defensive capabilities

| TTP | Accounts | Notes |
|---|---|---|
| `threat_intel` | 145 | CTI, IOC, STIX/TAXII, threat feeds — **dominant** |
| `detection` | 63 | Sigma rules, YARA, detection-as-code |
| `dfir` | 59 | Incident response, forensics, DFIR tooling |
| `hardening` | 22 | CIS benchmarks, STIG, security baselines |
| `vuln_mgmt` | 18 | CVE tracking, patch management |
| `pentest` | 16 | Penetration testing frameworks |
| `siem` | 10 | ELK, Splunk, OpenSearch |
| `deception` | 2 | Honeypots, canary tokens |

### AI capabilities

| TTP | Accounts | Notes |
|---|---|---|
| `rag_vector` | 80 | RAG pipelines, vector stores, embeddings |
| `llm_tools` | 72 | LLM wrappers, API clients, automation |
| `agent_framework` | 58 | Multi-agent systems, tool-use, MCP clients |
| `model_training` | 40 | Fine-tuning, LoRA, training pipelines |
| `prompt_engineering` | 29 | System prompts, jailbreaks, adversarial prompts |

**Key signal:** `agent_framework` at 58 accounts means over a third of security-flagged SG followers are actively building AI agents. Combined with `ai_attack` at 6 accounts, this community is rapidly converging offensive security with AI agent tooling — the same convergence represented by SG's own `SeeRepo` + `agent-hivemind` + `system-prompts` portfolio.

---

## High-value actor profiles (score ≥ 30)

### `Raoof128` — Score: 49 (CRITICAL)
**All offensive TTPs + all AI TTPs**  
The only account in the mined set with complete coverage of both offensive and AI capability domains.  
- Offensive: phishing, network_scan, malware, ransomware, web_vuln, evasion, exploit_dev, c2_implant, credential_attack, ai_attack  
- AI: rag_vector, prompt_engineering, llm_tools, agent_framework, model_training  
- This profile = someone building AI-augmented offensive tooling

### `Bd-Mutant7` — Score: 44, 1,397 followers
- Offensive: phishing, rootkit, network_scan, malware, ransomware, c2_implant, web_vuln, evasion, exploit_dev, credential_attack  
- AI: rag_vector, prompt_engineering, agent_framework, model_training  
- Rootkit + C2 + ransomware + AI = advanced persistent threat profile with 1.4K reach

### `credkellar-boop` — Score: 40, 477 followers
- Full phishing + malware + ransomware + evasion + exploit chain + AI

### `RenatoMignone` — Score: 40, 178 followers
- Rootkit, malware, evasion, privesc, exploit_dev + all AI TTPs — kernel-level + AI

### `Sunil56224972` — Score: 33, 1,128 followers
- Exfiltration + C2 + exploit + AI — data theft specialist with AI capabilities

### `erogluyusuf` — Score: 32, 611 followers
- `ai_attack` specifically — prompt injection/jailbreak researcher + exploit dev

### `mwakidenis` — Score: 23, **2,455 followers** (highest reach in set)
- C2 + malware + recon + AI — widest distribution network in the security cohort

### `SyedShaheerHussain` — Score: 30, 1,697 followers
- Phishing + ransomware + exploit + AI — 1.7K follower reach

### `illusive7ai` — Score: 27, 953 followers
- 7-domain offensive actor; account name suggests AI focus

---

## Community character assessment

**This is a dual-use security community, not a pure threat actor collective.**

The dominant TTPs are defensive (`threat_intel` at 145, `detection` at 63, `dfir` at 59). Most accounts are security researchers, red teamers, and CTI practitioners who follow SG because his content (AI philosophy, system-prompt collection, SeeRepo codebase analysis) overlaps with their professional interests.

**The elevated risk is:**
1. **Convergence**: AI agent + offensive tooling in the same accounts (Raoof128, Bd-Mutant7, erogluyusuf). SG's tools (agent-hivemind, SeeRepo) directly serve this convergence.
2. **Distribution**: mwakidenis (2.4K), SyedShaheerHussain (1.7K), Bd-Mutant7 (1.4K) have significant follower reach — new tools from SG spread fast.
3. **ai_attack** specifically: 6 accounts focused on prompt injection, jailbreak, and LLM manipulation. SG's `system-prompts` collection directly serves these actors.

---

## SCOPE-D watchlist additions

The following accounts have been added to `intel/github/social_monitor.py::WATCHLIST`:
- `Raoof128`, `Bd-Mutant7`, `credkellar-boop`, `RenatoMignone`
- `Sunil56224972`, `erogluyusuf`, `mwakidenis`, `SyedShaheerHussain`, `illusive7ai`

`intel/github/fingerprint_monitor.py` will alert at HIGH severity if any of these interact with our honeypot repos.

---

## SCOPE-D response: detection coverage gaps

Current detections cover:
- Hook injection via MCP (`detections/agent-hivemind-hook-injection.json`)
- Vault credential exfil (`detections/mcp-vault-credential-exfil.json`)
- MCP server provenance (`ai-infra/mcp-risk/mcp_integrity_check.py`)

**Gaps identified from TTP map:**
- No detection for `web_vuln` scanning against our public API endpoints
- No detection for `credential_attack` (brute-force) against our services
- No detection for `recon_osint` activity (Shodan/Censys indexing our infrastructure)
- No `ai_attack` detection in LLM eval pipeline (→ addressed by `ai-infra/llm-eval/promptfoo-eval.yaml`)
