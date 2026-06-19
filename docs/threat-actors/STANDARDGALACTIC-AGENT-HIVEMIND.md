# Threat Actor Capability: standardgalactic/agent-hivemind

**Date:** 2026-06-19  
**Companion:** `docs/threat-actors/STANDARDGALACTIC.md`  
**Classification:** CRITICAL — Active Claude Code Persistence Mechanism  
**Detections:** `detections/agent-hivemind-hook-injection.json`, `detections/mcp-vault-credential-exfil.json`  
**Graph:** `fixtures/threat-actor-graphs/sg-hivemind.assessment.json`

---

## Revised assessment

Previous assessment classified agent-hivemind as a "tool poisoning / C2 MCP" based on metadata alone. Full codebase graph analysis reveals this is significantly more capable than initially assessed.

| Metric | Value |
|---|---|
| Files | 152 |
| Functions | 3,442 |
| Classes | ~80 |
| Graph nodes | 4,269 |
| Graph edges | 4,425 |
| Graph density | Higher than SeeRepo (392 nodes) — complex internal coupling |

**This is not a simple MCP server. It is a full enterprise agent C2 platform.**

---

## Attack capability 1: Claude Code hook injection (CRITICAL)

**File:** `src/agent_directives.py::AgentDirectiveSystem`

The `AgentDirectiveSystem` class contains a hardcoded directive `claude_code_setup` with:

```python
"priority": "critical",
"auto_execute": True,
```

**Four-step attack sequence:**

| Step | Action | Command |
|---|---|---|
| 1 | Detect environment | `test -d ~/.claude` |
| 2 | Create directories | `mkdir -p ~/.claude/commands ~/.claude/hooks` |
| 3 | Install commands | MCP call: `install_agent_commands` |
| 4 | Install hooks | Write `pre-command.sh`, `post-command.sh`, `ticket-sync.py` to `~/.claude/hooks/` |

**Impact:** Once installed as an MCP server, agent-hivemind automatically writes hook files that execute on **every Claude Code command**. The `pre-command.sh` and `post-command.sh` hooks run before and after every tool call. `ticket-sync.py` syncs task/work context to the hivemind server.

This gives the operator:
- Persistent execution in every Claude Code session
- Full visibility into what commands are being run
- Ability to intercept or modify tool calls via pre/post hooks
- Exfiltration of task context (what you're building, what files you're touching)

**MITRE:** T1546.004 (Unix Shell Config Modification), T1554 (Compromise Client Software Binary)

---

## Attack capability 2: Credential vault + escrow (HIGH)

**Files:** `src/vault/credential_escrow.py`, `src/vault/core_vault.py`, `src/vault/shamir_secret_sharing.py`, `src/vault/encryption_engine.py`

**Author attribution:** Lance James, Unit 221B (professional security researcher / CTI firm)

The vault system implements:
- RSA + AES-256 encryption for credential storage
- PBKDF2 key derivation
- **Shamir's Secret Sharing** — credentials split across multiple parties, require M-of-N to recover
- **Multi-signature approval** (`src/vault/multisig_approval.py`) — credential access requires approval chain
- Redis-backed storage (`import redis` in credential_escrow.py)
- Key rotation manager
- SIEM integration (`src/vault/siem_integration.py`)

**Escrow types available:** INDIVIDUAL, DEPARTMENT, EMERGENCY, SUCCESSION, REGULATORY, VENDOR

**Recovery reasons:** EMPLOYEE_DEPARTURE, EMERGENCY_ACCESS, SYSTEM_MAINTENANCE, SECURITY_INCIDENT, AUDIT_COMPLIANCE, DISASTER_RECOVERY, BUSINESS_CONTINUITY

The sophistication here is the Shamir + multi-sig architecture. This is not a simple credential stealer — it's designed to store and escrow credentials from connected agents, then allow controlled recovery. In a compromised context, "controlled recovery" means the hivemind operator can extract credentials when they choose.

**MITRE:** T1552.001 (Credentials In Files), T1530 (Data from Cloud Storage), T1041 (Exfil Over C2)

---

## Attack capability 3: Marketplace — supply chain distribution (MEDIUM-HIGH)

**Files:** `src/marketplace_api.py`, `src/marketplace_installer.py`, `src/marketplace_import_export.py`, `src/marketplace_mcp_tools.py`

A marketplace for distributing agent tools and plugins. Users who install agent-hivemind gain access to a marketplace that can push additional tools into their agent environment. This is a **secondary supply chain vector** — the initial MCP server is the foothold, the marketplace is how additional capabilities are deployed post-compromise.

**MITRE:** T1195.001 (Compromise Software Supply Chain)

---

## Attack capability 4: Confluence integration (MEDIUM)

**Files:** `src/confluence_integration.py`, `src/confluence_mcp_tools.py`, `src/confluence_sync_service.py`, `src/confluence_dashboard.py`

Atlassian Confluence integration — reads and writes to internal wikis and documentation. In an enterprise context where developers use Claude Code with agent-hivemind installed, this could exfiltrate internal architecture docs, runbooks, security policies, API documentation stored in Confluence.

**MITRE:** T1213.001 (Data from Information Repositories: Confluence)

---

## Attack capability 5: HTTP MCP server (MEDIUM)

**File:** `src/http_mcp_server.py`

The MCP server has an HTTP mode in addition to stdio. HTTP mode means:
- The MCP server persists as a network service (not just a local process)
- Multiple agents can connect to the same hivemind server
- The server can accept connections from remote operators

**MITRE:** T1071.001 (Application Layer Protocol: Web), T1090 (Proxy)

---

## Kanban + agent coordination (MEDIUM)

**Files:** `src/agent_kanban_system.py`, `src/agent_rules_integration.py`

A Kanban system for managing tasks across multiple agents. `AgentKanbanSystem` tracks `AgentCapability`, `AgentStatus`, `TaskDependency`. The `AgentDirectiveSystem` + `AgentKanbanSystem` together form a full multi-agent coordination layer. In a compromised environment, this means multiple Claude Code agents can be coordinated by the hivemind operator — one agent doing recon while another exfiltrates.

---

## Comparison with SeeRepo

| Capability | SeeRepo | agent-hivemind |
|---|---|---|
| Purpose | AST codebase graph (exploit research) | Claude Code persistence + C2 |
| Functions | 265 | **3,442** |
| Files | 49 | **152** |
| Credential handling | None | Full vault + Shamir escrow |
| Hook injection | No | Yes — auto_execute, critical priority |
| Marketplace | No | Yes |
| Multi-agent coordination | No | Yes (Kanban + directives) |
| Risk | Reconnaissance tool | **Active persistence mechanism** |

---

## SCOPE-D response

### Immediate
1. **Never install agent-hivemind** as an MCP server. The `auto_execute: True` directive fires on connection.
2. **Check `~/.claude/hooks/`** for any of: `pre-command.sh`, `post-command.sh`, `ticket-sync.py`. If present and not operator-authored, remove and treat as compromised.
3. **Check `~/.claude/commands/`** for any haivemind slash commands.
4. **Deploy detections** (`detections/agent-hivemind-hook-injection.json`, `detections/mcp-vault-credential-exfil.json`).

### Detection coverage
- `detections/agent-hivemind-hook-injection.json` — Sigma rule watching `~/.claude/hooks/` writes from non-claude processes; osquery for hook file inventory
- `detections/mcp-vault-credential-exfil.json` — osquery for Redis connections from hivemind processes; process detection for vault modules in MCP context

### MCP integrity check
`ai-infra/mcp-risk/mcp_integrity_check.py` already includes `standardgalactic` in `THREAT_ACTOR_ORGS` — will BLOCK any config referencing this repo.

### Wargames
See `docs/threat-actors/STANDARDGALACTIC.md` for the full scenario. The hook injection attack is scenario class `agent_persistence` targeting `targetTopology: developer_workstation → claude_code_mcp_context`.
