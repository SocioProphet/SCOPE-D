# Playbook: Recon / OSINT Footprinting Detection

**Rules:** `sigma_dns_recon`, `sigma_github_recon`, `osquery_recon_tools`
**Severity:** HIGH
**MITRE:** T1590, T1591, T1593, T1595.001
**Detection file:** `detections/recon-osint-footprinting.json`

## Trigger conditions

- **DNS burst:** > 50 unique DNS queries in 60 seconds from a single process — subdomain brute-force or zone-walk pattern.
- **GitHub recon burst:** > 30 GitHub API calls to `/users/`, `/orgs/`, or `/search/` within 10 minutes against mdheller or SocioProphet assets.
- **Recon tool detected:** `amass`, `subfinder`, `shodan`, `theHarvester`, `recon-ng`, or `maltego` running on a monitored host.

## Immediate response (< 15 min)

1. **Identify the source** — is this internal tooling (expected SCOPE-D OSINT run), automated crawler, or external actor?
   - Internal SCOPE-D runs emit receipts to `raw/osint_receipts.jsonl` — check if a matching record exists.
   - If no receipt exists → not an authorized SCOPE-D run.
2. **Capture the recon target list** — what domains/usernames/IPs was the actor querying? This is intelligence about their interests.
3. **Rate-limit / block at perimeter** — if external actor is scraping GitHub API against your orgs, contact GitHub Security to rate-limit or investigate the source token.
4. **Add queried accounts to watchlist** — if the actor is enumerating mdheller followers/repos:
   ```python
   # intel/github/social_monitor.py WATCHLIST
   "newly_discovered_handle",  # queried during recon on <date>
   ```

## Investigation

5. **Correlate with SG network** — is the source IP associated with known SG infrastructure?
   ```bash
   python intel/osint/osint_runner.py --target <source_ip> \
     --policy engagement-policy-incident-response \
     --auth "recon-incident-$(date +%Y%m%d)" \
     --scope public_research_no_pii \
     --operator michael@socioprophet.ai
   ```
6. **Check timing against SG activity** — cross-reference with the SG crawl corpus. Did the recon follow a new SG repo push or a new SG follower of mdheller?
7. **GitHub audit log** — `gh api /orgs/SocioProphet/audit-log` for API access logs. Note: requires admin token.
8. **Check for parallel C2 activity** — recon often precedes exploitation. Run `sigma_mcp_c2_channel` detection in parallel.

## Enrichment queries (SCOPE-D)

```bash
# Profile the recon source
python intel/osint/osint_runner.py --target <source_ip_or_domain> \
  --policy engagement-policy-research \
  --auth "recon-hunt: $(date +%Y%m%d)" \
  --scope public_research_no_pii \
  --operator michael@socioprophet.ai

# Check any domains the recon tool queried (from DNS logs)
for domain in <queried_domain_1> <queried_domain_2>; do
  python intel/osint/certs_lookup.py --target "$domain" \
    --policy engagement-policy-research --auth "recon-hunt" \
    --scope public_research_no_pii --fixture
done
```

## Escalation criteria

- Source IP resolves to SG-network ASN or known SG actor → **log TTP in SG-NETWORK-TTP-MAP.md, increment T1590 count**
- Recon targets include internal/non-public assets (not just public GitHub) → **escalate, check for insider threat or compromised credential**
- Recon tool found on a SCOPE-D build machine → **assume compromise, treat as MCP C2 incident**
