#!/usr/bin/env python3
"""Social graph monitoring daemon for SCOPE-D threat intel lane.

Polls GitHub for new followers/following connections involving:
  - Known SG-network security-flagged accounts
  - Accounts on the manual watchlist

Writes ThreatIntelFeed JSONL records to intel/github/raw/social_alerts.jsonl
and prints console alerts for any new connections found.

Usage:   python intel/github/social_monitor.py [--login mdheller] [--once]
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
SCOPE_D = Path(os.path.expanduser("~/dev/SCOPE-D"))
DB_PATH = WS / "inventory.db"
ALERTS_PATH = WS / "raw" / "social_alerts.jsonl"

WATCHLIST = [
    "divinecmarie-jpg",       # starred agent-hivemind + system-prompts
    "dracoloveforall-crypto",  # in our following, starred SG brain
    "Abraxas2506",             # named after SG repo, starred brain
    "standardgalactic",        # primary threat actor
    # TTP miner: full-spectrum offensive + AI (scored 30-49)
    "Raoof128",                # every offensive TTP + all AI TTPs
    "Bd-Mutant7",              # rootkit+C2+ransomware+AI, 1.4K followers
    "credkellar-boop",         # phishing+malware+ransomware+exploit+AI
    "RenatoMignone",           # rootkit+malware+evasion+privesc+AI
    "Sunil56224972",           # exfil+C2+exploit+AI, 1.1K followers
    "erogluyusuf",             # ai_attack+exploit+credential, 611 followers
    "mwakidenis",              # C2+malware+recon, 2.4K followers (top reach)
    "SyedShaheerHussain",      # phishing+ransomware+exploit, 1.7K followers
    "illusive7ai",             # 7-TTP offensive actor, 953 followers
    # Flagged followers of mdheller discovered 2026-06-19 (posture audit)
    "Carrington-dev",          # 3.5K followers, security_signal — follows mdheller
    "backrat13",               # 23 followers, security_signal — follows mdheller
]

MONITORED_LOGINS = [
    "mdheller",
]


def gh(endpoint: str) -> list | dict | None:
    try:
        result = subprocess.run(
            ["gh", "api", "--paginate", endpoint],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            return None
        lines = result.stdout.strip().splitlines()
        items = []
        for line in lines:
            try:
                parsed = json.loads(line)
                if isinstance(parsed, list):
                    items.extend(parsed)
                else:
                    items.append(parsed)
            except json.JSONDecodeError:
                pass
        return items
    except Exception:
        return None


def get_known_connections(db: sqlite3.Connection, login: str) -> set[str]:
    rows = db.execute(
        "SELECT to_login FROM edges WHERE from_login=? UNION SELECT from_login FROM edges WHERE to_login=?",
        (login, login)
    ).fetchall()
    return {r[0].lower() for r in rows}


def get_sg_flagged(db: sqlite3.Connection) -> set[str]:
    rows = db.execute(
        "SELECT login FROM sg_accounts WHERE security_signal=1"
    ).fetchall()
    return {r[0].lower() for r in rows}


def write_alert(record: dict):
    ALERTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(ALERTS_PATH, "a") as f:
        f.write(json.dumps(record) + "\n")


def check_new_connections(db: sqlite3.Connection, login: str, sg_flagged: set[str], watchlist: set[str]):
    known = get_known_connections(db, login)
    alerts = []

    for direction, endpoint in [
        ("follower", f"users/{login}/followers"),
        ("following", f"users/{login}/following"),
    ]:
        items = gh(endpoint) or []
        for item in items:
            account = item.get("login", "").lower()
            if not account:
                continue

            is_new = account not in known
            is_sg = account in sg_flagged
            is_watch = account in watchlist

            if is_new and (is_sg or is_watch):
                reason = []
                if is_sg:
                    reason.append("SG-network security-flagged")
                if is_watch:
                    reason.append("explicit watchlist")
                alert = {
                    "id": str(uuid.uuid4()),
                    "type": "new_connection",
                    "sourceType": "osint",
                    "severity": "HIGH" if is_sg else "MEDIUM",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "monitored_login": login,
                    "direction": direction,
                    "account": account,
                    "account_url": f"https://github.com/{account}",
                    "reason": reason,
                    "action": "REVIEW_CONNECTION",
                }
                alerts.append(alert)
                write_alert(alert)
                print(f"  [ALERT] New {direction}: {account} — {', '.join(reason)}")

    return alerts


def check_watchlist_activity(watchlist_logins: list[str]):
    print("\nChecking watchlist account activity...")
    for login in watchlist_logins:
        items = gh(f"users/{login}/events/public") or []
        recent = [e for e in items if e.get("type") in ("PushEvent", "CreateEvent", "ForkEvent", "WatchEvent")]
        if recent:
            print(f"  [{login}] {len(recent)} recent events: {', '.join(set(e['type'] for e in recent))}")
        else:
            print(f"  [{login}] no recent public events")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--logins", nargs="*", default=MONITORED_LOGINS, help="GitHub logins to monitor")
    ap.add_argument("--once", action="store_true", help="Run once and exit (default: run once)")
    args = ap.parse_args()

    if not DB_PATH.exists():
        print(f"ERROR: DB not found at {DB_PATH}. Run intel/github/load_repos.py first.", file=sys.stderr)
        sys.exit(1)

    db = sqlite3.connect(DB_PATH)
    sg_flagged = get_sg_flagged(db)
    watchlist = {w.lower() for w in WATCHLIST}

    print(f"Social monitor — {datetime.now(timezone.utc).isoformat()}")
    print(f"  SG-flagged accounts in DB: {len(sg_flagged)}")
    print(f"  Explicit watchlist: {WATCHLIST}")
    print(f"  Monitoring: {args.logins}")
    print()

    all_alerts = []
    for login in args.logins:
        print(f"Checking {login}...")
        alerts = check_new_connections(db, login, sg_flagged, watchlist)
        all_alerts.extend(alerts)

    check_watchlist_activity(WATCHLIST)

    print(f"\nTotal new threat-relevant connections: {len(all_alerts)}")
    if all_alerts:
        print(f"Alerts written to: {ALERTS_PATH}")
    else:
        print("No new threat-relevant connections detected.")

    db.close()


if __name__ == "__main__":
    main()
