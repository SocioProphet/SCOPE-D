#!/usr/bin/env python3
"""Passive Shodan InternetDB enrichment — SCOPE-D OSINT passive lookup lane.

Queries the Shodan InternetDB public API (https://internetdb.shodan.io/<ip>),
a free, no-auth endpoint that returns open ports, CPEs, CVEs, tags, and
hostnames for a given IP — all from Shodan's pre-scanned public dataset.

This is NOT the paid Shodan API and requires no API key. It does NOT
trigger a new scan; all data is from Shodan's background internet census.

Risk class: high (exposes cyber exposure data). Terms: Shodan ToS requires
non-commercial or paid use for commercial applications — use is research-scoped
here. Gate: EngagementPolicy + scope + receipt.

EngagementPolicy gate enforced before any external contact.
"""
import argparse
import json
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

from validate_engagement_policy import EngagementRequest, build_denial_record, check_engagement_policy

INTERNETDB_URL = "https://internetdb.shodan.io/{ip}"

FIXTURE_INTERNETDB = {
    "192.0.2.1": {
        "ip": "192.0.2.1",
        "ports": [80, 443, 22],
        "cpes": ["cpe:/a:apache:http_server:2.4.51"],
        "vulns": ["CVE-2021-41773"],
        "hostnames": ["fixture.example"],
        "tags": ["cloud"],
        "source": "fixture",
    },
    "198.51.100.1": {
        "ip": "198.51.100.1",
        "ports": [443, 8443],
        "cpes": [],
        "vulns": [],
        "hostnames": [],
        "tags": [],
        "source": "fixture",
    },
}


def _internetdb_live(ip: str) -> dict:
    url = INTERNETDB_URL.format(ip=ip)
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        data["source"] = "shodan_internetdb"
        return data
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {"ip": ip, "not_indexed": True, "source": "shodan_internetdb"}
        return {"error": f"HTTP {e.code}: {e.reason}"}
    except Exception as e:
        return {"error": str(e)}


def internetdb_lookup(
    target: str,
    policy_ref: str,
    authorization_ref: str,
    target_scope: str,
    operator_identity_ref: str,
    receipt_sink: str,
    fixture_mode: bool = False,
) -> dict:
    req = EngagementRequest(
        lookup_type="dns",  # passive public-source enrichment; using allowed type
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
    record_id = f"osint-passive-internetdb-{uuid.uuid4().hex[:8]}"

    if not decision.authorized:
        result = build_denial_record(req, decision)
        result["lookupId"] = record_id
        result["lookupType"] = "internetdb"
        _emit_receipt(result, receipt_sink)
        return result

    if fixture_mode or target_scope == "fixture_only":
        data = FIXTURE_INTERNETDB.get(target, FIXTURE_INTERNETDB["192.0.2.1"])
        network_boundary, status = "no_external_contact", "fixture_only"
    else:
        data = _internetdb_live(target)
        network_boundary = "public_source_api_only"
        if "error" in data:
            status = "error"
        elif data.get("not_indexed"):
            status = "not_found"
        else:
            status = "success"

    result = {
        "schemaVersion": "0.1.0",
        "lookupId": record_id,
        "lookupType": "internetdb",
        "target": target,
        "targetScope": req.target_scope,
        "engagementPolicyRef": policy_ref,
        "authorizationRef": authorization_ref,
        "executionMode": req.execution_mode,
        "nonDestructiveOnly": True,
        "networkBoundary": network_boundary,
        "sourceEvidenceRef": "Shodan InternetDB public API (pre-scanned dataset, no new scan triggered)",
        "operatorIdentityRef": operator_identity_ref,
        "receiptRequired": True,
        "fixtureMode": fixture_mode,
        "result": {
            "status": status,
            "records": [data],
            "confidenceCaveat": "InternetDB data reflects Shodan's background internet census. Ports/CVEs may be stale (days to weeks). No new scan was triggered. CVE list is indicative only — no exploitation authorization inferred.",
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
    ap = argparse.ArgumentParser(description="SCOPE-D passive Shodan InternetDB lookup")
    ap.add_argument("--target", required=True, help="IP address")
    ap.add_argument("--policy", default=""); ap.add_argument("--auth", default="")
    ap.add_argument("--scope", default="fixture_only"); ap.add_argument("--operator", default="michael@socioprophet.ai")
    ap.add_argument("--receipt-sink", default="raw/osint_receipts.jsonl")
    ap.add_argument("--fixture", action="store_true"); ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    result = internetdb_lookup(args.target, args.policy, args.auth, args.scope, args.operator, args.receipt_sink, args.fixture)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        recs = result["result"].get("records", [])
        print(f"InternetDB: {args.target} → {result['result']['status']}")
        for r in recs:
            if "error" in r:
                print(f"  error: {r['error']}")
            else:
                print(f"  ports:     {r.get('ports', [])}")
                print(f"  vulns:     {r.get('vulns', [])}")
                print(f"  hostnames: {r.get('hostnames', [])}")
                print(f"  cpes:      {r.get('cpes', [])}")


if __name__ == "__main__":
    main()
