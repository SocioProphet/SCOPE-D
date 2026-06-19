# SCOPE-D GitHub Social Intelligence

OSINT collector for GitHub social graphs: repositories, followers, following,
fork lineage, and 2-hop network threat modeling.

Produces:
- SQLite database (`inventory.db`) — all repos, accounts, follow edges
- `GraphRobustnessAssessment` envelopes for social trust graphs
- `ThreatIntelFeed` records (sourceType: `osint`) for flagged actors
- Fork learning catalog — upstream lineage + staleness for tech intelligence

## What this is for

- **Network threat modeling** — who is 2 hops from your codebase? Who is watching?
- **Account sanitization** — identify noise, bots, and mass-follow operators in following lists
- **Fork intelligence** — map forked projects back to upstream sources for feature/design learning
- **Actor profiling** — bio, repos, interests, security-signal detection for 1-hop accounts

## Database schema

Tables (see `schema.sql`):

| Table | Purpose |
|---|---|
| `repos` | All repos across owned namespaces + orgs |
| `forks_catalog` | Forks resolved to upstream parent with staleness + learning notes |
| `accounts` | 1-hop and 2-hop social graph nodes with profiles and security signal |
| `account_repos` | Their repos (interest/capability signal) |
| `edges` | Directed follow graph |
| `sg_accounts` | Targeted actor network (e.g. standardgalactic) |
| `sg_edges` | Targeted actor follow edges |

## Collector policy

- Execution mode: `read_only` (GitHub GraphQL/REST API, no writes)
- Network egress: GitHub API only (`api.github.com`)
- Credential access: GitHub token (scope: `repo`, `admin:org`) — no `read:user` required
- Rate limit aware: pauses at GraphQL budget exhaustion, fully checkpointed
- No credential storage in DB
- Scope: authorized accounts (your own orgs + explicit threat-actor targets)

## Quick start

```bash
pip install openpyxl

# Pull all repos + social graph for your orgs
bash intel/github/fetch.sh

# Load into SQLite
python intel/github/load_repos.py

# Enrich forks with upstream parent data
python intel/github/forks_enrich.py

# Crawl 1-hop account profiles
python intel/github/crawl_social.py

# Targeted actor crawl (e.g. standardgalactic)
python intel/github/crawl_actor.py --login standardgalactic

# Export full workbook
python intel/github/export_all.py
```

## Outputs

- `inventory.db` — queryable SQLite, all tables above
- `github_inventory.xlsx` — 11-sheet workbook: Repos, Forks_Catalog, Accounts_1hop,
  Account_Repos, ThreatModel_Connectors, Security_Flagged, Unfollow_Candidates,
  DeadFork_Candidates, Risky_Accounts, Visibility_Audit, Summary
- `standardgalactic_intel.xlsx` — dedicated actor network workbook
- `raw/*.ndjson` — raw API data (checkpointed)
