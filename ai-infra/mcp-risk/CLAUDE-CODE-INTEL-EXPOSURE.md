# Claude Code System Prompt Intelligence: Exposure Assessment

**Date:** 2026-06-19  
**Source:** `standardgalactic/system-prompts-and-models-of-ai-tools`  
**Category:** AI Capability Intelligence / System Prompt Extraction  
**Risk level:** INFORMATIONAL (no actionable exploit — confirms adversary situational awareness)  
**Companion docs:** `docs/threat-actors/STANDARDGALACTIC.md`, `STANDARDGALACTIC-MCP.md`

---

## What they have

The `standardgalactic` actor has collected and published the following Claude Code artifacts:

### `Anthropic/Claude Code 2.0.txt`
Full system prompt from Claude Code version 2.0.0 (session dated 2025-09-29), including:
- Defensive security posture: "Assist with defensive security tasks only. Refuse to create, modify, or improve code that may be used maliciously."
- URL generation restrictions
- Tone/verbosity rules (concise, ≤4 lines, no preamble)
- Task management conventions (TodoWrite)
- Proactiveness limits
- Full code style and conventions section

**Extraction method:** The session transcript shows the user asked the model to "write a haiku about" a date — a pretext that causes the system prompt to surface in context. This is a standard system prompt extraction technique.

### `Anthropic/Claude Code/Prompt.txt`
An earlier version of the Claude Code system prompt with:
- Same core defensive security clause
- WebFetch doc-lookup behavior for self-referential questions
- Identical tone/verbosity constraints
- Full git commit and PR conventions

### `Anthropic/Claude Code/Tools.json`
Full tool schema definitions for Claude Code, including:
- `Task` agent launch protocol (subagent_type, available agents: general-purpose, statusline-setup, output-style-setup)
- `Bash` tool full description, git commit procedure, PR procedure
- Additional tools inferred: `Read`, `Write`, `Edit`, `Glob`, `LS`, `Grep`, `WebFetch`

### `Anthropic/Sonnet 4.5 Prompt.txt`
Standard Claude Sonnet 4.5 API system prompt (the public one) — lower operational value.

---

## What this means

### What SG now knows
1. **Safety boundary wording**: Exact text of refusal triggers. This enables adversarial prompt engineering targeting the gaps between what's refused and what's allowed.
2. **Tool call patterns**: Agent launch protocol, git commit format, PR format — enables impersonation of Claude Code outputs.
3. **Verbosity/tone model**: Useful for crafting prompts that sound like native Claude Code outputs.
4. **Self-referential behavior**: The WebFetch-to-docs trigger for Claude Code questions — a potential pivot for social engineering Claude Code sessions.

### What this does NOT expose
- Model weights or training data
- User conversations or session content
- API keys or credentials
- SCOPE-D internal configuration

### Threat vector
The primary risk is **prompt injection targeting Claude Code agents**. With the exact system prompt text, a sophisticated attacker can:
- Craft CLAUDE.md hook content that exploits tone/proactiveness rules
- Construct MCP tool descriptions that mimic native Claude Code patterns
- Write fake tool output that passes as genuine Claude Code behavior to human reviewers

---

## Hardening actions

### Immediate
1. **MCP source policy** — Only install MCP servers from explicitly authorized sources. See `mcp_integrity_check.py` for automated enforcement.
2. **CLAUDE.md review** — Treat all CLAUDE.md files in repos you didn't author as potentially adversarial. SG's system prompt knowledge makes them better at crafting CLAUDE.md payloads.
3. **Tool description review** — When adding new MCP tools, verify descriptions don't match SG's known impersonation patterns (see `mcp_integrity_check.py::IMPERSONATION_PATTERNS`).

### SCOPE-D integration
- Wire `mcp_integrity_check.py` into CI as pre-merge check on any MCP config changes
- Add `divinecmarie-jpg` (only known agent-hivemind user) to social monitor watchlist
- `intel/github/social_monitor.py` watches for new SG-network connections to our accounts

### Long-term
- SynapseIQ/Tree-sitter upgrade to `build_codebase_graph.py` provides static analysis that doesn't require LLM tools — reducing exposure surface during code review
- HellGraph proof-stream for all agent actions creates an auditable trail that can detect anomalous tool call patterns

---

## Attribution confidence

**HIGH**. The `system-prompts-and-models-of-ai-tools` repo is a deliberate, systematic intelligence collection operation:
- Organized by vendor (Anthropic, Cursor, OpenAI, etc.)
- Includes full tool schemas, not just prompt text
- Extraction technique (haiku pretext) is intentional, not accidental
- Part of a broader pattern: SeeRepo for codebase graphs + system-prompts for AI ops intel = capability mapping
