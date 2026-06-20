#!/usr/bin/env python3
"""Passive GitHub public context lookup — SCOPE-D OSINT passive lookup lane.

Queries GitHub's public REST API for user/org/repo metadata. Public data only.
No secrets harvesting, no repo content scraping, no credential enumeration.
Target: profile metadata, public repo list, follower counts, org membership.

Risk class: medium. Gate: API terms + no-credential boundary + receipt.

Uses GITHUB_TOKEN env var if present (60→5000 req/hr). Unauthenticated is
fine for low-volume use (60/hr). Never requests private scope.

EngagementPolicy gate enforced before any external contact.
"""
import argparse
import json
import os
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

from validate_engagement_policy import EngagementRequest, build_denial_record, check_engagement_policy

GH_API_USER  = "https://api.github.com/users/{handle}"
GH_API_REPOS = "https://api.github.com/users/{handle}/repos?per_page=100&sort=updated"
GH_API_ORG   = "https://api.github.com/orgs/{handle}"

FIXTURE_GH = {
    "fixture-user": {
        "type": "User",
        "login": "fixture-user",
        "name": "Fixture User",
        "company": "Fixture Corp",
        "blog": "https://fixture.example",
        "location": "Testville, US",
        "bio": "A test account for SCOPE-D fixture runs.",
        "public_repos": 12,
        "followers": 42,
        "following": 7,
        "created_at": "2020-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
        "repos": [
            {"name": "example-repo", "description": "Fixture repo", "stargazers_count": 5,
             "language": "Python", "pushed_at": "2024-01-01T00:00:00Z", "fork": False},
        ],
        "source": "fixture",
    },
}


def _gh_headers() -> dict:
    hdrs = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        hdrs["Authorization"] = f"Bearer {token}"
    return hdrs


def _gh_get(url: str) -> dict | list | None:
    try:
        req = urllib.request.Request(url, headers=_gh_headers())
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        return {"_error": f"HTTP {e.code}"}
    except Exception as e:
        return {"_error": str(e)}


def _fetch_profile(handle: str) -> dict:
    profile = _gh_get(GH_API_USER.format(handle=handle))
    if profile is None:
        profile = _gh_get(GH_API_ORG.format(handle=handle))
    if profile is None:
        return {"not_found": True}
    if isinstance(profile, dict) and "_error" in profile:
        return {"error": profile["_error"]}

    keep = ["login", "name", "type", "company", "blog", "location", "bio",
            "public_repos", "followers", "following", "created_at", "updated_at",
            "html_url", "avatar_url"]
    result = {k: profile.get(k) for k in keep if k in profile}

    repos_raw = _gh_get(GH_API_REPOS.format(handle=handle))
    if isinstance(repos_raw, list):
        result["repos"] = [
            {k: r.get(k) for k in ["name", "description", "stargazers_count",
                                    "language", "pushed_at", "fork", "topics"]}
            for r in repos_raw[:50]
        ]
    result["source"] = "github_public_api"
    return result


def github_context_lookup(
    target: str,
    policy_ref: str,
    authorization_ref: str,
    target_scope: str,
    operator_identity_ref: str,
    receipt_sink: str,
    fixture_mode: bool = False,
) -> dict:
    req = EngagementRequest(
        lookup_type="whois",  # public-source identity context — closest allowed type
        target=target,
        target_scope="fixture_only" if fixture_mode else target_scope,
        engagement_policy_ref=policy_ref,
        authorization_ref=authorization_ref,
        execution_mode="fixture" if fixture_mode else "passive_public_source",
        operator_identity_ref=operator_identity_ref,
        receipt_sink=receipt_sink,
        fixture_mode=fixture_mode,
        non_destructive_only=True,
    )
    decision = check_engagement_policy(req)
    record_id = f"osint-passive-github-{uuid.uuid4().hex[:8]}"

    if not decision.authorized:
        result = build_denial_record(req, decision)
        result["lookupId"] = record_id
        result["lookupType"] = "github_context"
        _emit_receipt(result, receipt_sink)
        return result

    if fixture_mode or target_scope == "fixture_only":
        data = FIXTURE_GH.get(target, FIXTURE_GH["fixture-user"])
        network_boundary, status = "no_external_contact", "fixture_only"
    else:
        data = _fetch_profile(target)
        network_boundary = "public_source_api_only"
        if "error" in data:
            status = "error"
        elif data.get("not_found"):
            status = "not_found"
        else:
            status = "success"

    result = {
        "schemaVersion": "0.1.0",
        "lookupId": record_id,
        "lookupType": "github_context",
        "target": target,
        "targetScope": req.target_scope,
        "engagementPolicyRef": policy_ref,
        "authorizationRef": authorization_ref,
        "executionMode": req.execution_mode,
        "nonDestructiveOnly": True,
        "networkBoundary": network_boundary,
        "sourceEvidenceRef": "GitHub public REST API v3 (public profile/org/repo metadata only)",
        "operatorIdentityRef": operator_identity_ref,
        "receiptRequired": True,
        "fixtureMode": fixture_mode,
        "result": {
            "status": status,
            "records": [data],
            "confidenceCaveat": "Public GitHub API only. No private repos, no secrets, no email harvesting. Profile data reflects GitHub public disclosure.",
        },
        "receiptEmitted": False,
        "queriedAt": datetime.now(timezone.utc).isoformat(),
        "actionAuthorizedReceipt": "gate_passed",
        "warnings": decision.warnings,
    }
    _emit_receipt(result, receipt_sink)
    result["receiptEmitted"] = True
    return result


def _emit_receipt(record: dict, sink: str):
    p = Path(sink)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "a") as f:
        f.write(json.dumps(record) + "\n")


def main():
    ap = argparse.ArgumentParser(description="SCOPE-D passive GitHub public context lookup")
    ap.add_argument("--target", required=True, help="GitHub username or org handle")
    ap.add_argument("--policy", default=""); ap.add_argument("--auth", default="")
    ap.add_argument("--scope", default="fixture_only"); ap.add_argument("--operator", default="michael@socioprophet.ai")
    ap.add_argument("--receipt-sink", default="raw/osint_receipts.jsonl")
    ap.add_argument("--fixture", action="store_true"); ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    result = github_context_lookup(args.target, args.policy, args.auth, args.scope, args.operator, args.receipt_sink, args.fixture)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        recs = result["result"].get("records", [])
        print(f"GitHub: {args.target} → {result['result']['status']}")
        for r in recs:
            if "error" in r or r.get("not_found"):
                print(f"  {r}")
            else:
                print(f"  {r.get('type','?')} · {r.get('name','?')} (@{r.get('login','?')})")
                print(f"  repos: {r.get('public_repos','?')}  followers: {r.get('followers','?')}  following: {r.get('following','?')}")
                for repo in r.get("repos", [])[:5]:
                    print(f"    → {repo.get('name')}  [{repo.get('language','?')}]  ⭐{repo.get('stargazers_count',0)}")


if __name__ == "__main__":
    main()
