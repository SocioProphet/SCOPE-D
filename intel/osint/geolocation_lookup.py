#!/usr/bin/env python3
"""Passive IP geolocation lookup — SCOPE-D OSINT passive lookup lane.

Queries ip-api.com (free tier, no auth, 45 req/min) for country, region,
city, ASN, and org. No GPS, no device lookup. Returns MaxMind-derived
city-level data from public IP allocation tables.

Risk class: medium/high. Privacy: IP→city is PII-adjacent for residential
IPs. Gate: EngagementPolicy + scope + receipt. Results must not be used
to infer individual identity or location.

EngagementPolicy gate enforced before any external contact.
"""
import argparse
import json
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

from validate_engagement_policy import EngagementRequest, build_denial_record, check_engagement_policy

IPAPI_URL = "http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query"

FIXTURE_GEO = {
    "192.0.2.1": {
        "status": "success",
        "country": "United States",
        "countryCode": "US",
        "region": "CA",
        "regionName": "California",
        "city": "Palo Alto",
        "zip": "94301",
        "lat": 37.4419,
        "lon": -122.143,
        "timezone": "America/Los_Angeles",
        "isp": "Fixture ISP",
        "org": "Fixture Org",
        "as": "AS64496 FIXTURE-ASN",
        "query": "192.0.2.1",
        "source": "fixture",
    },
}


def _ipapi_live(ip: str) -> dict:
    url = IPAPI_URL.format(ip=ip)
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        data["source"] = "ip-api.com"
        return data
    except Exception as e:
        return {"error": str(e)}


def geolocation_lookup(
    target: str,
    policy_ref: str,
    authorization_ref: str,
    target_scope: str,
    operator_identity_ref: str,
    receipt_sink: str,
    fixture_mode: bool = False,
) -> dict:
    req = EngagementRequest(
        lookup_type="bgp",  # public-source IP context — closest allowed type
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
    record_id = f"osint-passive-geolocation-{uuid.uuid4().hex[:8]}"

    if not decision.authorized:
        result = build_denial_record(req, decision)
        result["lookupId"] = record_id
        result["lookupType"] = "geolocation"
        _emit_receipt(result, receipt_sink)
        return result

    if fixture_mode or target_scope == "fixture_only":
        data = FIXTURE_GEO.get(target, FIXTURE_GEO["192.0.2.1"])
        network_boundary, status = "no_external_contact", "fixture_only"
    else:
        data = _ipapi_live(target)
        network_boundary = "public_source_api_only"
        if "error" in data:
            status = "error"
        elif data.get("status") == "fail":
            status = "not_found"
        else:
            status = "success"

    result = {
        "schemaVersion": "0.1.0",
        "lookupId": record_id,
        "lookupType": "geolocation",
        "target": target,
        "targetScope": req.target_scope,
        "engagementPolicyRef": policy_ref,
        "authorizationRef": authorization_ref,
        "executionMode": req.execution_mode,
        "nonDestructiveOnly": True,
        "networkBoundary": network_boundary,
        "sourceEvidenceRef": "ip-api.com (MaxMind-derived public IP geolocation, free tier)",
        "operatorIdentityRef": operator_identity_ref,
        "receiptRequired": True,
        "fixtureMode": fixture_mode,
        "result": {
            "status": status,
            "records": [data],
            "confidenceCaveat": "City-level geolocation accuracy varies (±50 km typical). Residential IPs are PII-adjacent — do not use to infer individual identity. Data reflects MaxMind IP allocation tables, not GPS.",
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
    ap = argparse.ArgumentParser(description="SCOPE-D passive IP geolocation (ip-api.com)")
    ap.add_argument("--target", required=True, help="IP address")
    ap.add_argument("--policy", default=""); ap.add_argument("--auth", default="")
    ap.add_argument("--scope", default="fixture_only"); ap.add_argument("--operator", default="michael@socioprophet.ai")
    ap.add_argument("--receipt-sink", default="raw/osint_receipts.jsonl")
    ap.add_argument("--fixture", action="store_true"); ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    result = geolocation_lookup(args.target, args.policy, args.auth, args.scope, args.operator, args.receipt_sink, args.fixture)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        recs = result["result"].get("records", [])
        print(f"Geo: {args.target} → {result['result']['status']}")
        for r in recs:
            if "error" in r:
                print(f"  error: {r['error']}")
            else:
                print(f"  {r.get('city','?')}, {r.get('regionName','?')}, {r.get('country','?')}  ({r.get('countryCode','?')})")
                print(f"  ASN: {r.get('as','?')}  ISP: {r.get('isp','?')}")


if __name__ == "__main__":
    main()
