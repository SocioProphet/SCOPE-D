#!/usr/bin/env python3
"""Passive CT log lookup via crt.sh — SCOPE-D OSINT passive lookup lane.

Queries the crt.sh public Certificate Transparency log API for issued
certificates matching a domain. No active TLS probing, no port scan.
Risk class: low (public CT log data only).

crt.sh is a public Sectigo research tool. All queries are logged by crt.sh.

EngagementPolicy gate enforced before any external contact.

Usage:
  python intel/osint/certs_lookup.py --target socioprophet.ai \
    --policy engagement-policy-owned-infra \
    --auth "owner: michael@socioprophet.ai" \
    --scope owned_infrastructure \
    --operator michael@socioprophet.ai \
    --receipt-sink raw/osint_receipts.jsonl

  # Fixture mode (no live contact):
  python intel/osint/certs_lookup.py --target fixture.example --fixture
"""
import argparse
import json
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

from validate_engagement_policy import EngagementRequest, build_denial_record, check_engagement_policy

CRTSH_API = "https://crt.sh/?q={domain}&output=json"

FIXTURE_CERTS = {
    "fixture.example": [
        {
            "id": 999999999,
            "logged_at": "2023-01-01T00:00:00Z",
            "not_before": "2023-01-01T00:00:00Z",
            "not_after": "2024-01-01T00:00:00Z",
            "common_name": "fixture.example",
            "matching_identities": "fixture.example",
            "issuer_name": "CN=Let's Encrypt Authority X3,O=Let's Encrypt,C=US",
        }
    ]
}


def _crtsh_live(domain: str, max_results: int = 100) -> list[dict]:
    url = CRTSH_API.format(domain=urllib.parse.quote(domain))
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
            return data[:max_results] if isinstance(data, list) else []
    except Exception as e:
        return [{"error": str(e)}]


def certs_lookup(
    target: str,
    policy_ref: str,
    authorization_ref: str,
    target_scope: str,
    operator_identity_ref: str,
    receipt_sink: str,
    fixture_mode: bool = False,
    max_results: int = 100,
) -> dict:
    req = EngagementRequest(
        lookup_type="certs",
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
    record_id = f"osint-passive-certs-{uuid.uuid4().hex[:8]}"

    if not decision.authorized:
        result = build_denial_record(req, decision)
        result["lookupId"] = record_id
        _emit_receipt(result, receipt_sink)
        return result

    if fixture_mode or target_scope == "fixture_only":
        records = FIXTURE_CERTS.get(target, FIXTURE_CERTS["fixture.example"])
        network_boundary = "no_external_contact"
        status = "fixture_only"
    else:
        import urllib.parse
        records = _crtsh_live(target, max_results)
        network_boundary = "public_source_api_only"
        if records and "error" in records[0]:
            status = "error"
        elif records:
            status = "success"
        else:
            status = "not_found"

    result = {
        "schemaVersion": "0.1.0",
        "lookupId": record_id,
        "lookupType": "certs",
        "target": target,
        "targetScope": req.target_scope,
        "engagementPolicyRef": policy_ref,
        "authorizationRef": authorization_ref,
        "executionMode": req.execution_mode,
        "nonDestructiveOnly": True,
        "networkBoundary": network_boundary,
        "sourceEvidenceRef": "crt.sh public Certificate Transparency log API",
        "operatorIdentityRef": operator_identity_ref,
        "receiptRequired": True,
        "fixtureMode": fixture_mode,
        "result": {
            "status": status,
            "records": records,
            "sourceVersion": "crt.sh CT log (real-time)",
            "confidenceCaveat": f"CT log data is publicly logged. Returned up to {max_results} most recent records. Older certs may not appear if CT logs have been pruned.",
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
    ap = argparse.ArgumentParser(description="SCOPE-D passive CT log lookup (crt.sh)")
    ap.add_argument("--target", required=True)
    ap.add_argument("--policy", default="")
    ap.add_argument("--auth", default="")
    ap.add_argument("--scope", default="fixture_only")
    ap.add_argument("--operator", default="michael@socioprophet.ai")
    ap.add_argument("--receipt-sink", default="raw/osint_receipts.jsonl")
    ap.add_argument("--fixture", action="store_true")
    ap.add_argument("--max-results", type=int, default=100)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    result = certs_lookup(
        target=args.target,
        policy_ref=args.policy,
        authorization_ref=args.auth,
        target_scope=args.scope,
        operator_identity_ref=args.operator,
        receipt_sink=args.receipt_sink,
        fixture_mode=args.fixture,
        max_results=args.max_results,
    )

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        recs = result["result"].get("records", [])
        print(f"certs: {args.target} → {result['result']['status']} ({len(recs)} records)")
        for r in recs[:5]:
            print(f"  {r.get('not_before','?')[:10]} → {r.get('not_after','?')[:10]}  {r.get('common_name', r.get('error',''))}")
        if len(recs) > 5:
            print(f"  ... and {len(recs)-5} more")


if __name__ == "__main__":
    main()
