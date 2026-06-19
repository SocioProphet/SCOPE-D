#!/usr/bin/env python3
"""Fingerprint adversaries who interact with our honeypot and real repos.

For each watched repo, polls:
  - stargazers (who starred, when)
  - forkers (who forked)
  - watchers (who watches)
  - traffic views + clones (volume anomaly detection)
  - referrers (what sites are linking to our repos)

Cross-references every account against the SG network DB (sg_accounts,
accounts with security_signal). Any hit is a fingerprint event — we know
exactly who they are, when they touched us, and what they touched.

Outputs:
  - Console alert for every fingerprint hit
  - JSONL records in raw/fingerprints.jsonl (threat-intel-feed format)
  - Traffic anomaly records in raw/traffic_anomalies.jsonl

Usage:
  python intel/github/fingerprint_monitor.py [--repos owner/name ...]
"""
import argparse
import json
import os
import sqlite3
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path


WS = Path(os.path.expanduser("~/dev/gh-inventory"))
DB_PATH = WS / "inventory.db"
FINGERPRINTS_PATH = WS / "raw" / "fingerprints.jsonl"
TRAFFIC_PATH = WS / "raw" / "traffic_anomalies.jsonl"

OWNED_REPOS = [
    "mdheller/gh-inventory",
    "SocioProphet/socioprophet",
    "SocioProphet/SCOPE-D",
]

HONEYPOT_REPOS_FILE = WS / "raw" / "honeypots.jsonl"

CLONE_SPIKE_THRESHOLD = 10
VIEW_SPIKE_THRESHOLD = 50


def gh(endpoint: str, paginate: bool = True) -> list | dict | None:
    cmd = ["gh", "api", endpoint]
    if paginate:
        cmd.append("--paginate")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return None
        items = []
        for line in result.stdout.strip().splitlines():
            try:
                parsed = json.loads(line)
                if isinstance(parsed, list):
                    items.extend(parsed)
                else:
                    items.append(parsed)
            except Exception:
                pass
        return items if paginate else (items[0] if items else None)
    except Exception:
        return None


def load_threat_logins(db: sqlite3.Connection) -> dict[str, dict]:
    """Returns login -> {source, security_signal, bio, relation} for all known threat accounts."""
    threat = {}
    rows = db.execute(
        "SELECT login, security_signal, bio, relation FROM accounts WHERE security_signal=1 OR relation IN ('follower','following','mutual')"
    ).fetchall()
    for r in rows:
        threat[r[0].lower()] = {"source": "1hop", "security_signal": bool(r[1]), "bio": r[2], "relation": r[3]}

    sg_rows = db.execute(
        "SELECT login, security_signal, bio, relation FROM sg_accounts WHERE crawled=1"
    ).fetchall()
    for r in sg_rows:
        login = r[0].lower()
        entry = {"source": "sg_network", "security_signal": bool(r[1]), "bio": r[2], "relation": r[3]}
        if login not in threat or r[1]:
            threat[login] = entry

    return threat


def load_seen_fingerprints() -> set[str]:
    if not FINGERPRINTS_PATH.exists():
        return set()
    seen = set()
    for line in FINGERPRINTS_PATH.read_text().splitlines():
        try:
            r = json.loads(line)
            seen.add(f"{r['repo']}:{r['account']}:{r['interaction']}")
        except Exception:
            pass
    return seen


def write_fingerprint(record: dict):
    FINGERPRINTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(FINGERPRINTS_PATH, "a") as f:
        f.write(json.dumps(record) + "\n")


def write_traffic_anomaly(record: dict):
    TRAFFIC_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(TRAFFIC_PATH, "a") as f:
        f.write(json.dumps(record) + "\n")


def fingerprint_repo(repo: str, threat_logins: dict, seen: set, is_honeypot: bool) -> list[dict]:
    hits = []
    repo_label = "[HONEYPOT]" if is_honeypot else "[REAL]"

    for interaction, endpoint in [
        ("star", f"repos/{repo}/stargazers"),
        ("fork", f"repos/{repo}/forks"),
        ("watch", f"repos/{repo}/subscribers"),
    ]:
        items = gh(endpoint) or []
        for item in items:
            login = (item.get("login") or item.get("owner", {}).get("login", "")).lower()
            if not login:
                continue
            key = f"{repo}:{login}:{interaction}"
            if key in seen:
                continue
            seen.add(key)

            threat_info = threat_logins.get(login)
            severity = None
            if is_honeypot:
                severity = "HIGH" if (threat_info and threat_info["security_signal"]) else "MEDIUM"
            elif threat_info and threat_info["security_signal"]:
                severity = "HIGH"
            elif threat_info and threat_info["source"] == "sg_network":
                severity = "MEDIUM"

            if severity is None:
                continue

            fp = {
                "id": str(uuid.uuid4()),
                "schemaVersion": "0.1.0",
                "sourceType": "osint",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "repo": repo,
                "is_honeypot": is_honeypot,
                "account": login,
                "account_url": f"https://github.com/{login}",
                "interaction": interaction,
                "severity": severity,
                "threat_source": threat_info["source"] if threat_info else "unknown",
                "security_signal": threat_info["security_signal"] if threat_info else False,
                "bio": (threat_info["bio"] or "")[:120] if threat_info else "",
                "relation": threat_info["relation"] if threat_info else "",
                "indicators": [
                    f"Interacted ({interaction}) with {'honeypot' if is_honeypot else 'real'} repo {repo}",
                    f"Account in {threat_info['source'] if threat_info else 'unknown'} threat network",
                ] + (["Account has security bio signal"] if threat_info and threat_info["security_signal"] else []),
            }
            hits.append(fp)
            write_fingerprint(fp)

            tag = "HONEYPOT HIT" if is_honeypot else "THREAT ACTOR"
            print(f"  [{severity}] {tag} — {login} {interaction}d {repo}")
            print(f"    source={fp['threat_source']}  bio={fp['bio'][:60]}")

    return hits


def check_traffic(repo: str) -> list[dict]:
    anomalies = []
    for metric, endpoint in [
        ("views", f"repos/{repo}/traffic/views"),
        ("clones", f"repos/{repo}/traffic/clones"),
    ]:
        data = gh(endpoint, paginate=False)
        if not data:
            continue
        if isinstance(data, list):
            data = data[0] if data else {}

        total = data.get("count", 0) or 0
        uniques = data.get("uniques", 0) or 0
        threshold = VIEW_SPIKE_THRESHOLD if metric == "views" else CLONE_SPIKE_THRESHOLD

        if total >= threshold:
            record = {
                "id": str(uuid.uuid4()),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "repo": repo,
                "metric": metric,
                "total": total,
                "uniques": uniques,
                "threshold": threshold,
                "severity": "HIGH" if total >= threshold * 3 else "MEDIUM",
            }
            anomalies.append(record)
            write_traffic_anomaly(record)
            print(f"  [TRAFFIC] {repo} — {metric}: {total} total / {uniques} unique (threshold={threshold})")

    referrers = gh(f"repos/{repo}/traffic/referrers", paginate=False) or []
    for ref in referrers:
        source = ref.get("referrer", "")
        count = ref.get("count", 0)
        if any(kw in source.lower() for kw in ["standardgalactic", "github.com/standardgalactic", "seerepo"]):
            record = {
                "id": str(uuid.uuid4()),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "repo": repo,
                "metric": "referrer",
                "referrer": source,
                "count": count,
                "severity": "HIGH",
                "note": "Known threat actor referral source",
            }
            anomalies.append(record)
            write_traffic_anomaly(record)
            print(f"  [REFERRER] {repo} — {source} ({count} views) — THREAT ACTOR REFERRAL")

    return anomalies


def load_honeypot_repos() -> list[str]:
    if not HONEYPOT_REPOS_FILE.exists():
        return []
    repos = []
    for line in HONEYPOT_REPOS_FILE.read_text().splitlines():
        try:
            repos.append(json.loads(line)["repo"])
        except Exception:
            pass
    return repos


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repos", nargs="*", default=None, help="Additional repos to monitor (owner/name)")
    args = ap.parse_args()

    if not DB_PATH.exists():
        print(f"ERROR: DB not found at {DB_PATH}", file=sys.stderr)
        sys.exit(1)

    db = sqlite3.connect(DB_PATH)
    threat_logins = load_threat_logins(db)
    db.close()

    seen = load_seen_fingerprints()
    honeypot_repos = load_honeypot_repos()
    real_repos = list(OWNED_REPOS) + (args.repos or [])

    print(f"Fingerprint monitor — {datetime.now(timezone.utc).isoformat()}")
    print(f"  Threat network size: {len(threat_logins)} accounts")
    print(f"  Honeypot repos: {honeypot_repos}")
    print(f"  Real repos: {real_repos}")
    print(f"  Previously seen fingerprints: {len(seen)}")
    print()

    all_hits = []

    print("=== HONEYPOT REPOS ===")
    for repo in honeypot_repos:
        print(f"\n{repo}")
        hits = fingerprint_repo(repo, threat_logins, seen, is_honeypot=True)
        all_hits.extend(hits)
        check_traffic(repo)

    print("\n=== REAL REPOS ===")
    for repo in real_repos:
        print(f"\n{repo}")
        hits = fingerprint_repo(repo, threat_logins, seen, is_honeypot=False)
        all_hits.extend(hits)
        check_traffic(repo)

    print(f"\n{'='*50}")
    print(f"Total fingerprint hits this run: {len(all_hits)}")
    high = [h for h in all_hits if h["severity"] == "HIGH"]
    medium = [h for h in all_hits if h["severity"] == "MEDIUM"]
    print(f"  HIGH: {len(high)}   MEDIUM: {len(medium)}")
    if all_hits:
        print(f"  Written to: {FINGERPRINTS_PATH}")


if __name__ == "__main__":
    main()
