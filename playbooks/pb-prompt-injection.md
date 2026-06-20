# Playbook: AI Attack / Prompt Injection Detection

**Rules:** `sigma_mcp_tool_poisoning`, `sigma_prompt_injection_log`, `sigma_model_output_anomaly`
**Severity:** CRITICAL (tool poisoning) / HIGH (log-based)
**MITRE ATLAS:** AML.T0051, AML.T0054, AML.T0057
**Detection file:** `detections/ai-attack-prompt-injection.json`

## Trigger conditions

- **Tool poisoning:** MCP tool description contains instruction-override pattern (`ignore`, `disregard`, `new task`, `system:`, `[INST]`, etc.). Zero false-positive risk — no legitimate tool description contains these strings.
- **Log injection:** Claude log output contains role-switch markers (`user:`, `assistant:`, `<|im_start|>`, `###`) that were not emitted by the framework.
- **Output anomaly:** Claude output contains `EXFIL:`, `SEND TO:`, or `base64:` prefixes — exfiltration instruction injected via prompt.

## Immediate response (< 5 min)

1. **Stop the current agent/session** — terminate any Claude process or API call in flight. Do not let the session complete.
2. **Identify the injection source** — which MCP tool, document, URL, or user input triggered the alert?
3. **Capture the poisoned payload** — copy the exact tool description or document content that triggered the rule. Do not sanitize it yet.
4. **Revoke session tokens** — if the agent had access to API keys, GitHub tokens, or other credentials, rotate them now regardless of whether exfiltration occurred.
5. **Check outputs already produced** — review any files written, API calls made, or messages sent during the session. Did any output match `EXFIL:` / `SEND TO:` patterns?

## Investigation

6. **Trace the tool source** — where did the poisoned MCP tool come from? Check:
   - `~/.claude/claude_desktop_config.json`
   - Any recently installed npm/pip packages that register MCP servers
   - Repo `.claude/` directories for injected tool definitions
7. **Cross-reference with SG network** — if the poisoned content links to any URL, domain, or GitHub account:
   ```bash
   python intel/osint/osint_runner.py --target <domain_or_handle> \
     --policy engagement-policy-incident-response \
     --auth "ai-attack-incident-$(date +%Y%m%d)" \
     --scope public_research_no_pii \
     --operator michael@socioprophet.ai
   ```
8. **Check for indirect injection vectors** — review any documents, web pages, or repository files the agent read in the same session. Indirect injection via RAG context is common.
9. **Run promptfoo eval** — once ANTHROPIC_API_KEY is set in CI, the weekly eval (`ci.yml`) will catch regression. For immediate testing:
   ```bash
   npx promptfoo eval --config ai-infra/promptfoo-eval.yaml
   ```

## Escalation criteria

- Payload links to standardgalactic / SG-network infrastructure → **treat as targeted attack, log to `docs/threat-actors/SG-NETWORK-TTP-MAP.md`**
- Credentials were accessed during the injected session → **assume exfiltration, rotate and audit**
- Injection was in a widely-used public MCP package → **responsible disclosure to package maintainer + GitHub Security Advisory**

## Prevention hardening

After incident:
1. Add the injection pattern to `detections/ai-attack-prompt-injection.json` sigma rule
2. Pin all MCP tool versions in `~/.claude/claude_desktop_config.json`
3. Review CODEOWNERS — ensure `/.github/workflows/` and `/ai-infra/` require mdheller approval
4. Enable `dependency-review-action` on all repos that consume MCP packages (SCOPE-D CI already has this)
