# Playbook: SG Network Actor — New Account / New Infrastructure

**Trigger:** New SG-network account discovered by `analyze_sg_hub.py` crawl, or new IP/domain attributed to SG actor
**Severity:** MEDIUM → escalates to HIGH if technical capability confirmed
**Detection:** SG crawl (PID / scheduled), `intel/github/social_monitor.py`
**TTP map:** `docs/threat-actors/SG-NETWORK-TTP-MAP.md`

## On new account discovery

1. **Add to crawl queue** — the SG crawl auto-discovers follows/forks. Verify the new account appears in `sg_accounts` with `crawled=1` before acting.
2. **Check security_signal** — accounts with `security_signal=1` in inventory.db get priority enrichment:
   ```bash
   python intel/osint/github_context_lookup.py \
     --target <new_handle> \
     --policy engagement-policy-research \
     --auth "SG-network-mapping: public profile only" \
     --scope public_research_no_pii \
     --operator michael@socioprophet.ai \
     --receipt-sink raw/sg_enrichment_receipts.jsonl
   ```
3. **Run full OSINT profile** if the account is a hub (> 100 followers or > 50 repos):
   ```bash
   python intel/osint/osint_runner.py --target <handle_or_domain> \
     --policy engagement-policy-research \
     --auth "SG-network-hub-$(date +%Y%m%d)" \
     --scope public_research_no_pii \
     --operator michael@socioprophet.ai
   ```
4. **Update TTP map** — increment account count and re-run `analyze_sg_hub.py` once crawl completes:
   ```bash
   python intel/github/analyze_sg_hub.py
   ```

## On new IP / domain attribution

5. **Run InternetDB + BGP + geolocation**:
   ```bash
   python intel/osint/osint_runner.py --target <ip_or_domain> \
     --policy engagement-policy-research \
     --auth "SG-infra-mapping: $(date +%Y%m%d)" \
     --scope public_research_no_pii \
     --operator michael@socioprophet.ai
   ```
6. **CT log check** — new domains often show certificates before DNS propagates:
   ```bash
   python intel/osint/certs_lookup.py --target <domain> \
     --policy engagement-policy-research \
     --auth "SG-infra" --scope public_research_no_pii
   ```
7. **Check for CVEs on exposed services** — InternetDB result will contain CVE list. Cross-reference each with:
   ```bash
   python intel/osint/cve_lookup.py --target <CVE-ID> \
     --policy engagement-policy-research \
     --auth "SG-vuln-enrichment" --scope public_research_no_pii
   ```
8. **Add to watchlist** if new domain/IP confirms SG attribution:
   ```python
   # intel/github/social_monitor.py or separate ioc_watchlist.json
   ```

## Escalation criteria

- New SG hub account with > 1K followers and security-related repos → **priority crawl, full OSINT profile within 24h**
- SG-attributed IP/domain hosting active services (ports open per InternetDB) → **log to ioc_watchlist, notify if we have MCP exposure**
- SG account directly follows mdheller or makes contact → **escalate to active engagement posture, review GitHub org members**

## TTP map update template

After each significant new discovery, update `docs/threat-actors/SG-NETWORK-TTP-MAP.md`:
- Increment account / repo counts
- Add new technique if not already in table
- Add detection gap row if no SCOPE-D rule covers the new behavior
