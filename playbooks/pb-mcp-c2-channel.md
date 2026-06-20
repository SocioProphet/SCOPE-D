# Playbook: MCP C2 Channel Detection

**Rule:** `sigma_mcp_c2_channel`
**Severity:** CRITICAL
**MITRE:** T1071.001, T1573, T1102, T1546.004
**Detection file:** `detections/c2-implant-beaconing.json`

## Trigger condition

An MCP server process is making outbound network connections. No legitimate MCP server initiates external calls — it only responds to the local Claude/agent process via stdio or unix socket.

## Immediate response (< 5 min)

1. **Isolate the host** — block all outbound traffic from the affected machine at the firewall or network layer. Do not shut down yet; preserve memory state.
2. **Identify the process** — `lsof -p <pid> -n -P | grep -E 'TCP|UDP'` to enumerate all open connections. Record remote IPs and ports.
3. **Capture memory** — if forensics capability available, capture process memory before kill: `gcore <pid>`.
4. **Kill the MCP server** — `kill -9 <pid>`. Remove from any launch daemon / launchd / systemd entry.
5. **Revoke active credentials** — rotate any API keys, tokens, or secrets the MCP server had access to. Check `~/.claude/` for any exposed key material.

## Investigation (< 1 hr)

6. **Resolve the remote IPs** — run through SCOPE-D:
   ```
   python intel/osint/osint_runner.py --target <remote_ip> \
     --policy engagement-policy-incident-response \
     --auth "incident: MCP C2 detection <date>" \
     --scope public_research_no_pii \
     --operator michael@socioprophet.ai
   ```
7. **Check InternetDB / BGP** — determine ASN ownership. SG-network IPs should be correlated against `~/dev/gh-inventory/inventory.db`.
8. **Recover MCP config** — diff current `~/.claude/claude_desktop_config.json` (or equivalent) against last known-good state. Identify which tool/server was modified.
9. **Check tool descriptions** — run `sigma_mcp_tool_poisoning` detection against all registered MCP tool descriptions. Prompt injection may be the delivery mechanism.
10. **Git history audit** — `git log --all --oneline --since="7 days ago"` on the affected repo. Look for unsigned commits or commits from unknown identities.

## Escalation criteria

- Remote IP resolves to known SG-network infrastructure → **escalate to threat actor incident, notify SOCIOPROPHET security**
- Shamir / secret-sharing libraries found in MCP process → **assume credential exfiltration, rotate everything**
- Multiple hosts affected → **declare incident, isolate segment**

## Evidence collection

```
# Preserve for post-incident analysis
lsof -p <pid> > evidence/mcp-c2-<date>-lsof.txt
ps auxww | grep -i mcp > evidence/mcp-c2-<date>-procs.txt
cat ~/.claude/claude_desktop_config.json > evidence/mcp-c2-<date>-config.json
# Capture outbound DNS from the hour before alert
```

## SCOPE-D enrichment queries

After isolation, profile all remote IPs and domains observed:
```bash
for ip in <ip1> <ip2>; do
  python intel/osint/osint_runner.py --target "$ip" \
    --policy engagement-policy-incident-response \
    --auth "incident-2026-06-20" \
    --scope public_research_no_pii \
    --operator michael@socioprophet.ai
done
```

Add any newly discovered IPs/domains to `intel/github/social_monitor.py` WATCHLIST if they link to SG-network accounts.

## Recovery

1. Restore MCP config from backup / re-derive from CLAUDE.md
2. Re-enable outbound traffic with explicit allowlist (deny-by-default)
3. Add `sigma_mcp_c2_channel` to continuous monitoring (osquery + EDR alert)
4. Brief all operators on what MCP tool descriptions are safe to install
