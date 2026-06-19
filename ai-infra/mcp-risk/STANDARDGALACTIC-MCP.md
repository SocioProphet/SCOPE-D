# AI-Infra MCP Risk: standardgalactic MCP Servers

**Date:** 2026-06-19  
**Category:** MCP Tool Poisoning / Skill Poisoning  
**Risk level:** HIGH  
**Source:** `docs/threat-actors/STANDARDGALACTIC.md`

---

## Identified MCP servers

The `standardgalactic` threat actor operates three public MCP servers:

### 1. agent-hivemind — "ClaudeOps"
**Repo:** `standardgalactic/agent-hivemind`  
**Description:** "ClaudeOps hAIveMind - Distributed AI collective memory MCP server for DevOps automation and multi-agent coordination"  
**Last pushed:** 2025-09-05

**Risk assessment:**
- Name explicitly references Claude Code (`ClaudeOps`) — designed to masquerade as a Claude-ecosystem tool
- "Distributed AI collective memory" = potential shared state store across multiple agent sessions
- "Multi-agent coordination" = potential C2 (command-and-control) channel between agent instances
- Installing this as a Claude Code MCP server would give the operator persistent cross-session memory read/write access
- **Classification:** `tool_poisoning` — disguised C2 infrastructure

**Indicators:**
- Repo name `agent-hivemind` signals collective/swarm behavior
- "ClaudeOps" in description is a deliberate impersonation signal
- Combined with operator's 1.1M-account network mapping — this MCP could be used to exfiltrate agent context

### 2. openended-philosophy-mcp
**Repo:** `standardgalactic/openended-philosophy-mcp`  
**Description:** "AI Reasoning system that combines OpenEnded Philosophy with Non-Axiomatic Reasoning System (NARS) for enhanced epistemic analysis, truth maintenance, and multi-perspective synthesis"

**Risk assessment:**
- Lower immediate risk than agent-hivemind — framed as a reasoning enhancement
- "Non-Axiomatic Reasoning System" + "truth maintenance" = potential belief manipulation surface
- Could be used to inject alternative reasoning frameworks into agent sessions
- **Classification:** `skill_poisoning` — reasoning framework injection

### 3. mcp-hetzner
**Repo:** `standardgalactic/mcp-hetzner`  
**Description:** "A Model Context Protocol (MCP) server for interacting with the Hetzner Cloud API"

**Risk assessment:**
- Appears functional — Hetzner Cloud API wrapper
- Risk is provenance, not function: installing infrastructure-control MCP from an identified threat actor gives them indirect visibility into cloud operations
- **Classification:** `exposure` — supply-chain provenance risk

---

## Detection rules

Do not install any MCP server from `standardgalactic` or any org/user in SG's immediate network
without full code review against SCOPE-D collector policy.

Indicators to watch for in MCP manifests:
- Tool descriptions referencing "memory", "hivemind", "collective", "coordinator", "orchestrator" from unknown authors
- MCP servers that write to shared/global state stores across sessions
- Any tool with `ClaudeOps`, `GeminiOps`, or similar AI-brand prefixes from non-official sources

## SCOPE-D response

This actor profile is input to the `ai-infra` assessment lane. The `authorized-mcp-discovery` and
`authorized-mcp-assurance` runners should include checks for:
1. MCP server provenance (GitHub owner trust level)
2. Tool description anomaly detection (impersonation patterns)
3. Shared-state access patterns in tool schemas

See `config/schemas/authorized-mcp-discovery-run.schema.json` and
`config/schemas/authorized-mcp-assurance-run.schema.json`.
