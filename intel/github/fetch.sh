#!/usr/bin/env bash
# Pull repo + social inventory for mdheller across personal + 3 orgs.
set -o pipefail
WS="$HOME/dev/gh-inventory"
RAW="$WS/raw"
mkdir -p "$RAW"
ME=mdheller

log(){ echo "[$(date +%H:%M:%S)] $*"; }

# ---- Repos: one NDJSON row per repo, tagged with which bucket it came from ----
fetch_repos(){
  local bucket="$1"
  local endpoint="$2"
  local out="$RAW/repos_${bucket}.ndjson"
  log "repos: $bucket -> $endpoint"
  BUCKET="$bucket" gh api --paginate "$endpoint" \
    --jq '.[] | {bucket:env.BUCKET, owner:.owner.login, name:.name, full_name:.full_name, private:.private, fork:.fork, archived:.archived, language:.language, stars:.stargazers_count, forks:.forks_count, pushed_at:.pushed_at, created_at:.created_at, description:.description, topics:(.topics|join(";")), html_url:.html_url}' \
    > "$out" 2>"$RAW/repos_${bucket}.err"
  log "repos: $bucket done -> $(wc -l < "$out") rows"
}

fetch_repos "mdheller"       "user/repos?per_page=100&affiliation=owner&visibility=all"
fetch_repos "socioprophet"   "orgs/socioprophet/repos?per_page=100&type=all"
fetch_repos "socios-linux"   "orgs/socios-linux/repos?per_page=100&type=all"
fetch_repos "sourceos-linux" "orgs/sourceos-linux/repos?per_page=100&type=all"

# ---- Social graph ----
log "starred"
gh api --paginate "user/starred?per_page=100" \
  --jq '.[] | {full_name:.full_name, owner:.owner.login, fork:.fork, language:.language, stars:.stargazers_count, description:.description, topics:(.topics|join(";")), html_url:.html_url}' \
  > "$RAW/starred.ndjson" 2>"$RAW/starred.err"
log "starred done -> $(wc -l < "$RAW/starred.ndjson") rows"

log "followers"
gh api --paginate "users/$ME/followers?per_page=100" \
  --jq '.[] | {login:.login, html_url:.html_url, type:.type}' \
  > "$RAW/followers.ndjson" 2>"$RAW/followers.err"
log "followers done -> $(wc -l < "$RAW/followers.ndjson") rows"

log "following"
gh api --paginate "user/following?per_page=100" \
  --jq '.[] | {login:.login, html_url:.html_url, type:.type}' \
  > "$RAW/following.ndjson" 2>"$RAW/following.err"
log "following done -> $(wc -l < "$RAW/following.ndjson") rows"

log "ALL DONE"
touch "$RAW/.complete"
