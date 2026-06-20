#!/usr/bin/env python3
"""Passive phone intelligence lookup — SCOPE-D OSINT passive lookup lane.

Resolves a phone number to carrier, line type (mobile/landline/VOIP), and
country — using Numverify API (free tier: 100/mo) or abstract API.
No person identification, no call records, no subscriber name lookup.

Privacy boundary: phone number → carrier/line-type only. This is metadata
enrichment for threat-intel correlation (e.g. verifying a threat actor contact),
not person-level identification.

Legal hold resolved: operator authorization 2026-06-20.
Gate: EngagementPolicy + scope + privacy caveat required.

EngagementPolicy gate enforced before any external contact.
"""
import argparse
import json
import os
import re
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

from validate_engagement_policy import EngagementRequest, build_denial_record, check_engagement_policy

# Numverify — set NUMVERIFY_API_KEY env var for live lookups
NUMVERIFY_URL = "http://apilayer.net/api/validate?access_key={key}&number={number}&country_code=&format=1"

E164_RE = re.compile(r"^\+?[1-9]\d{6,14}$")

FIXTURE_PHONES = {
    "+15555550100": {
        "number": "+15555550100",
        "valid": True,
        "local_format": "555-555-0100",
        "international_format": "+1 555 555 0100",
        "country_code": "US",
        "country_name": "United States",
        "carrier": "Fixture Mobile Inc.",
        "line_type": "mobile",
        "source": "fixture",
    },
    "+15555550199": {
        "number": "+15555550199",
        "valid": True,
        "local_format": "555-555-0199",
        "international_format": "+1 555 555 0199",
        "country_code": "US",
        "country_name": "United States",
        "carrier": "Fixture VOIP LLC",
        "line_type": "voip",
        "source": "fixture",
    },
}


def _numverify_live(number: str) -> dict:
    key = os.environ.get("NUMVERIFY_API_KEY", "")
    if not key:
        return {"error": "NUMVERIFY_API_KEY not set. Set env var for live lookups. Fixture mode always available."}
    url = NUMVERIFY_URL.format(key=key, number=urllib.parse.quote(number))
    try:
        import urllib.parse
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        if "error" in data:
            return {"error": f"Numverify: {data['error'].get('info', str(data['error']))}"}
        return {
            "number": data.get("number"),
            "valid": data.get("valid"),
            "local_format": data.get("local_format"),
            "international_format": data.get("international_format"),
            "country_code": data.get("country_code"),
            "country_name": data.get("country_name"),
            "location": data.get("location"),
            "carrier": data.get("carrier"),
            "line_type": data.get("line_type"),
            "source": "numverify",
        }
    except Exception as e:
        return {"error": str(e)}


def phone_lookup(
    target: str,
    policy_ref: str,
    authorization_ref: str,
    target_scope: str,
    operator_identity_ref: str,
    receipt_sink: str,
    fixture_mode: bool = False,
) -> dict:
    req = EngagementRequest(
        lookup_type="whois",
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
    record_id = f"osint-passive-phone-{uuid.uuid4().hex[:8]}"

    if not decision.authorized:
        result = build_denial_record(req, decision)
        result["lookupId"] = record_id
        result["lookupType"] = "phone"
        _emit_receipt(result, receipt_sink)
        return result

    if not E164_RE.match(target.replace(" ", "").replace("-", "")):
        data = {"error": f"Invalid phone number format: '{target}'. Use E.164 format (e.g. +15555550100)."}
        status, network_boundary = "error", "no_external_contact"
    elif fixture_mode or target_scope == "fixture_only":
        data = FIXTURE_PHONES.get(target, FIXTURE_PHONES["+15555550100"])
        status, network_boundary = "fixture_only", "no_external_contact"
    else:
        import urllib.parse
        data = _numverify_live(target)
        network_boundary = "public_source_api_only"
        status = "error" if "error" in data else ("success" if data.get("valid") else "not_found")

    result = {
        "schemaVersion": "0.1.0",
        "lookupId": record_id,
        "lookupType": "phone",
        "target": target,
        "targetScope": req.target_scope,
        "engagementPolicyRef": policy_ref,
        "authorizationRef": authorization_ref,
        "executionMode": req.execution_mode,
        "nonDestructiveOnly": True,
        "networkBoundary": network_boundary,
        "sourceEvidenceRef": "Numverify phone validation API (carrier/line-type metadata only)",
        "operatorIdentityRef": operator_identity_ref,
        "receiptRequired": True,
        "fixtureMode": fixture_mode,
        "result": {
            "status": status,
            "records": [data],
            "confidenceCaveat": "Phone lookup returns carrier/line-type metadata only. No subscriber name, no call records, no person identification. Carrier data may be stale (number portability not always reflected in real-time).",
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
    ap = argparse.ArgumentParser(description="SCOPE-D passive phone intelligence (carrier/line-type only)")
    ap.add_argument("--target", required=True, help="Phone number in E.164 format (e.g. +15555550100)")
    ap.add_argument("--policy", default=""); ap.add_argument("--auth", default="")
    ap.add_argument("--scope", default="fixture_only"); ap.add_argument("--operator", default="michael@socioprophet.ai")
    ap.add_argument("--receipt-sink", default="raw/osint_receipts.jsonl")
    ap.add_argument("--fixture", action="store_true"); ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    result = phone_lookup(args.target, args.policy, args.auth, args.scope, args.operator, args.receipt_sink, args.fixture)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        recs = result["result"].get("records", [])
        print(f"Phone: {args.target} → {result['result']['status']}")
        for r in recs:
            if "error" in r:
                print(f"  error: {r['error']}")
            else:
                print(f"  carrier:   {r.get('carrier','?')}")
                print(f"  line_type: {r.get('line_type','?')}")
                print(f"  country:   {r.get('country_name','?')} ({r.get('country_code','?')})")


if __name__ == "__main__":
    main()
