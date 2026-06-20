#!/usr/bin/env python3
"""Enrich the SG threat corpus with OSINT data.

Reads sg_accounts from ~/dev/gh-inventory/inventory.db (or a safe copy),
profiles high-signal accounts and discovered domains through the OSINT runner,
and writes enrichment records back to a SQLite enrichment DB and JSONL receipt.

Priority tiers:
  TIER 1 — security_signal=1 accounts (direct threat relevance)
  TIER 2 — hub accounts: followers > 100 or public_repos > 50
  TIER 3 — remaining crawled accounts (batch, lower concurrency)

Safe-copy mode (default): copies inventory.db to /tmp before reading, since
the live SG crawl (if running) may hold a write lock.

Usage:
  python intel/enrichment/enrich_sg_corpus.py \
    --policy engagement-policy-sg-research \
    --auth "SG threat network mapping: public profiles only" \
    --scope public_research_no_pii \
    --operator michael@socioprophet.ai \
    --limit 50 \
    --tier 1

  # Fixture mode (no network contact):
  python intel/enrichment/enrich_sg_corpus.py --fixture --limit 5
"""
import argparse
import json
import shutil
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "osint"))
from osint_runner import run_profile

INVENTORY_DB   = Path.home() / "dev" / "gh-inventory" / "inventory.db"
ENRICHMENT_DB  = Path(__file__).parent.parent.parent / "raw" / "sg_enrichment.db"
RECEIPT_SINK   = Path(__file__).parent.parent.parent / "raw" / "sg_enrichment_receipts.jsonl"
TMP_DB         = Path("/tmp/inventory_enrich.db")


def _open_inventory(safe_copy: bool = True) -> sqlite3.Connection:
    if safe_copy:
        shutil.copy2(INVENTORY_DB, TMP_DB)
        return sqlite3.connect(TMP_DB)
    return sqlite3.connect(INVENTORY_DB)


def _ensure_enrichment_db() -> sqlite3.Connection:
    ENRICHMENT_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(ENRICHMENT_DB)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sg_enrichment (
            id          TEXT PRIMARY KEY,
            handle      TEXT NOT NULL,
            target_type TEXT,
            enriched_at TEXT,
            profile_id  TEXT,
            profile_path TEXT,
            tier        INTEGER,
            lane_statuses TEXT,
            error       TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_handle ON sg_enrichment(handle)")
    conn.commit()
    return conn


def _already_enriched(econn: sqlite3.Connection, handle: str) -> bool:
    row = econn.execute(
        "SELECT id FROM sg_enrichment WHERE handle = ? AND error IS NULL", (handle,)
    ).fetchone()
    return row is not None


def _get_accounts(iconn: sqlite3.Connection, tier: int, limit: int) -> list[dict]:
    if tier == 1:
        where = "security_signal = 1"
    elif tier == 2:
        where = "(followers_n > 100 OR public_repos > 50)"
    else:
        where = "1=1"
    rows = iconn.execute(
        f"SELECT login, followers_n, public_repos, security_signal FROM sg_accounts "
        f"WHERE crawled = 1 AND {where} ORDER BY followers_n DESC, public_repos DESC LIMIT ?",
        (limit,)
    ).fetchall()
    return [{"login": r[0], "followers": r[1], "public_repos": r[2], "security_signal": r[3]} for r in rows]


def enrich_corpus(
    policy_ref: str,
    authorization_ref: str,
    target_scope: str,
    operator_identity_ref: str,
    tier: int = 1,
    limit: int = 50,
    concurrency: int = 4,
    fixture_mode: bool = False,
    safe_copy: bool = True,
    resume: bool = True,
) -> dict:
    run_id = f"sg-enrich-{uuid.uuid4().hex[:8]}"
    started_at = datetime.now(timezone.utc).isoformat()
    print(f"[{run_id}] SG corpus enrichment started — tier={tier} limit={limit} fixture={fixture_mode}")

    if not INVENTORY_DB.exists() and not fixture_mode:
        return {"error": f"Inventory DB not found: {INVENTORY_DB}. Run the SG crawl first."}

    econn = _ensure_enrichment_db()
    receipt_sink = str(RECEIPT_SINK)

    if fixture_mode:
        accounts = [
            {"login": "fixture-user-1", "followers": 250, "public_repos": 30, "security_signal": 1},
            {"login": "fixture-user-2", "followers": 5,   "public_repos": 3,  "security_signal": 0},
        ][:limit]
    else:
        try:
            iconn = _open_inventory(safe_copy)
            accounts = _get_accounts(iconn, tier, limit)
            iconn.close()
        except Exception as e:
            return {"error": f"Failed to read inventory DB: {e}"}

    print(f"[{run_id}] Accounts to process: {len(accounts)}")

    processed, skipped, failed = 0, 0, 0
    for acct in accounts:
        handle = acct["login"]

        if resume and _already_enriched(econn, handle):
            print(f"  skip (already enriched): {handle}")
            skipped += 1
            continue

        print(f"  profiling: {handle} (followers={acct['followers']}, repos={acct['public_repos']}, signal={acct['security_signal']})")
        try:
            profile = run_profile(
                target=handle,
                policy_ref=policy_ref,
                authorization_ref=authorization_ref,
                target_scope=target_scope,
                operator_identity_ref=operator_identity_ref,
                receipt_sink=receipt_sink,
                fixture_mode=fixture_mode,
                concurrency=concurrency,
                out_dir=str(ENRICHMENT_DB.parent),
            )
            econn.execute(
                "INSERT OR REPLACE INTO sg_enrichment VALUES (?,?,?,?,?,?,?,?,?)",
                (
                    str(uuid.uuid4()),
                    handle,
                    ",".join(profile.get("targetTypes", [])),
                    datetime.now(timezone.utc).isoformat(),
                    profile.get("profileId"),
                    profile.get("profilePath"),
                    tier,
                    json.dumps(profile.get("summary", {}).get("laneStatuses", {})),
                    None,
                )
            )
            econn.commit()
            processed += 1
        except Exception as e:
            print(f"  ERROR: {handle}: {e}")
            econn.execute(
                "INSERT OR REPLACE INTO sg_enrichment VALUES (?,?,?,?,?,?,?,?,?)",
                (str(uuid.uuid4()), handle, None,
                 datetime.now(timezone.utc).isoformat(), None, None, tier, None, str(e))
            )
            econn.commit()
            failed += 1

    econn.close()
    summary = {
        "runId": run_id,
        "tier": tier,
        "total": len(accounts),
        "processed": processed,
        "skipped": skipped,
        "failed": failed,
        "startedAt": started_at,
        "completedAt": datetime.now(timezone.utc).isoformat(),
        "enrichmentDb": str(ENRICHMENT_DB),
        "receiptSink": receipt_sink,
    }
    print(f"[{run_id}] Done — processed={processed} skipped={skipped} failed={failed}")
    return summary


def main():
    ap = argparse.ArgumentParser(description="Enrich SG corpus with OSINT data")
    ap.add_argument("--tier", type=int, choices=[1, 2, 3], default=1,
                    help="1=security_signal, 2=hubs (followers>100 or repos>50), 3=all")
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--concurrency", type=int, default=4)
    ap.add_argument("--policy", default="")
    ap.add_argument("--auth", default="")
    ap.add_argument("--scope", default="public_research_no_pii")
    ap.add_argument("--operator", default="michael@socioprophet.ai")
    ap.add_argument("--no-safe-copy", action="store_true", help="Read inventory.db directly (risk: locked by crawl)")
    ap.add_argument("--no-resume", action="store_true", help="Re-enrich already-processed accounts")
    ap.add_argument("--fixture", action="store_true")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    result = enrich_corpus(
        policy_ref=args.policy,
        authorization_ref=args.auth,
        target_scope=args.scope,
        operator_identity_ref=args.operator,
        tier=args.tier,
        limit=args.limit,
        concurrency=args.concurrency,
        fixture_mode=args.fixture,
        safe_copy=not args.no_safe_copy,
        resume=not args.no_resume,
    )
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        for k, v in result.items():
            print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
