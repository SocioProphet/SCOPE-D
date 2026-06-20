# SG Network: TTP Map and High-Value Actor Inventory

**Date:** 2026-06-19 (updated after expanded crawl)  
**Source:** `intel/github/sg_repo_miner.py` — repos of 1,016 security-flagged SG network accounts  
**Status:** COMPLETE — 1,016 accounts mined, 27,710 repos analyzed (crawl at 47%, 12,000/25,540 SG accounts)  
**Companion:** `docs/threat-actors/STANDARDGALACTIC.md`, `STANDARDGALACTIC-HUB-ANALYSIS.md`

---

## TTP prevalence across SG security community

### Offensive capabilities (accounts with each TTP)

| TTP | Accounts (1016) | vs Prior (682) | Notes |
|---|---|---|---|
| `web_vuln` | **454** | +48% | SQLi, XSS, RCE, LFI, SSRF — most common; broad web attack tooling |
| `credential_attack` | **146** | +265% | Password crackers, brute-force, hashcat |
| `network_scan` | **131** | +385% | Port scanners, nmap wrappers, network enumeration |
| `recon_osint` | **121** | +426% | Shodan, enumeration, footprinting |
| `exploit_dev` | **95** | +296% | Exploit frameworks, PoC repos, CVE tooling |
| `c2_implant` | **87** | +358% | Command-and-control frameworks, beacons, RATs |
| `malware` | **71** | +407% | Malware samples, analysis, development |
| `fuzzing` | **53** | +253% | AFL, honggfuzz, coverage-guided fuzzers |
| `phishing` | **49** | +444% | Phishing kits, GoPhish configs, credential harvesting |
| `evasion` | **42** | +320% | AV/EDR bypass, AMSI bypass, obfuscation |
| `ransomware` | **34** | +209% | Ransomware builders, samples, analysis |
| `ai_attack` | **19** | **+217%** | Prompt injection, jailbreak, LLM manipulation — **fastest-growing vector** |
| `privesc` | **13** | +550% | Local privilege escalation |
| `rootkit` | **9** | +200% | Kernel-level persistence |
| `exfiltration` | **7** | +250% | Data theft tooling |
| `lateral_movement` | **4** | new | Pass-the-hash, Kerberoasting, BloodHound |

### Defensive capabilities

| TTP | Accounts (1016) | vs Prior (682) | Notes |
|---|---|---|---|
| `threat_intel` | **769** | +48% | CTI, IOC, STIX/TAXII, threat feeds — **dominant** |
| `detection` | **310** | +392% | Sigma rules, YARA, detection-as-code |
| `dfir` | **271** | +359% | Incident response, forensics, DFIR tooling |
| `hardening` | **118** | +436% | CIS benchmarks, STIG, security baselines |
| `pentest` | **97** | +506% | Penetration testing frameworks |
| `vuln_mgmt` | **73** | +306% | CVE tracking, patch management |
| `siem` | **38** | +280% | ELK, Splunk, OpenSearch |
| `deception` | **15** | +650% | Honeypots, canary tokens |

### AI capabilities

| TTP | Accounts (1016) | vs Prior (682) | Notes |
|---|---|---|---|
| `rag_vector` | **328** | +310% | RAG pipelines, vector stores, embeddings |
| `llm_tools` | **299** | +315% | LLM wrappers, API clients, automation |
| `agent_framework` | **294** | +407% | Multi-agent systems, tool-use, MCP clients — **29% of entire mined set** |
| `model_training` | **152** | +280% | Fine-tuning, LoRA, training pipelines |
| `prompt_engineering` | **118** | +307% | System prompts, jailbreaks, adversarial prompts |

**Key signal:** `agent_framework` at 294 accounts — 29% of the entire 1,016-account mined set is actively building AI agents. `ai_attack` tripled from 6 to 19 accounts with only 49% more accounts added, suggesting the AI-offensive convergence is accelerating within this community. This is the same convergence SG's own portfolio (`SeeRepo` + `agent-hivemind` + `system-prompts`) is designed to serve.

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

**All detection gaps now closed as of 2026-06-19:**

| Detection file | Covers | Severity |
|---|---|---|
| `detections/agent-hivemind-hook-injection.json` | Hook injection / T1546.004 | CRITICAL |
| `detections/mcp-vault-credential-exfil.json` | Credential vault / T1552.001 | HIGH |
| `detections/web-vuln-api-scan-detection.json` | Web vuln scanning / T1595.002 | HIGH |
| `detections/credential-brute-force-detection.json` | Brute-force / T1110 | HIGH |
| `detections/recon-osint-footprinting.json` | Recon / T1590, T1591, T1595.001 | MEDIUM |
| `detections/c2-implant-beaconing.json` | C2 beaconing / T1071.001, T1102 | CRITICAL |
| `detections/ai-attack-prompt-injection.json` | Prompt injection, MCP poisoning / AML.T0051 | HIGH |
| `ai-infra/mcp-risk/mcp_integrity_check.py` | MCP supply chain provenance | HIGH |
| `ai-infra/llm-eval/promptfoo-eval.yaml` | LLM red-team evaluation (weekly CI) | — |

**One remaining operational gap:** `ANTHROPIC_API_KEY` must be set in SocioProphet/SCOPE-D GitHub secrets for `llm-eval.yml` to run the promptfoo eval tests.
