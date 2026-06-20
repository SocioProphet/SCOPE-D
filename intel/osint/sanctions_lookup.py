#!/usr/bin/env python3
"""Passive sanctions/watchlist matching — SCOPE-D OSINT passive lookup lane.

Matches a name, entity, or identifier against the OpenSanctions consolidated
dataset (https://www.opensanctions.org/datasets/default/) using the
OpenSanctions matching API or a local cached dataset snapshot.

Data sources aggregated by OpenSanctions: OFAC SDN, UN Consolidated List,
EU Consolidated List, INTERPOL Red Notices, and others (~40+ sources).

Risk class: medium/high. Attribution caveat required: false positive risk
is non-trivial for common names. Results must be reviewed by a human analyst
before any operational use. Gate: EngagementPolicy + attribution + caveat.

OpenSanctions API: https://api.opensanctions.org/ (free for research/NGO,
commercial use requires license). Fixture mode default.

EngagementPolicy gate enforced before any external contact.
"""
import argparse
import json
import urllib.request
import urllib.parse
import uuid
from datetime import datetime, timezone
from pathlib import Path

from validate_engagement_policy import EngagementRequest, build_denial_record, check_engagement_policy

OPENSANCTIONS_API = "https://api.opensanctions.org/match/default"

FIXTURE_SANCTIONS = {
    "John Doe": {
        "query": "John Doe",
        "results": [],
        "total": 0,
        "caveat": "No matches in fixture dataset. Common names have high false-positive risk — fixture only.",
        "source": "fixture",
    },
    "ACME Fixture Corp": {
        "query": "ACME Fixture Corp",
        "results": [
            {
                "id": "fixture-entity-001",
                "caption": "ACME Fixture Corp (FICTIONAL)",
                "schema": "Company",
                "datasets": ["fixture"],
                "score": 0.95,
                "match": True,
                "properties": {
                    "name": ["ACME Fixture Corp"],
                    "country": ["US"],
                    "sanctionedBy": ["FIXTURE_AUTHORITY"],
                },
            }
        ],
        "total": 1,
        "source": "fixture",
    },
}


def _opensanctions_live(query: str, schema: str = "Thing") -> dict:
    payload = json.dumps({
        "queries": {"q": {"schema": schema, "properties": {"name": [query]}}},
        "algorithm": "logic-v1",
        "threshold": 0.5,
        "cutoff": 0.4,
    }).encode()
    try:
        req = urllib.request.Request(
            OPENSANCTIONS_API,
            data=payload,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode())
        responses = data.get("responses", {}).get("q", {})
        results = responses.get("results", [])
        return {
            "query": query,
            "results": results[:20],
            "total": responses.get("total", 0),
            "source": "opensanctions_api",
        }
    except urllib.error.HTTPError as e:
        if e.code == 402:
            return {"error": "OpenSanctions API requires a license for commercial use. See https://www.opensanctions.org/licensing/"}
        return {"error": f"HTTP {e.code}"}
    except Exception as e:
        return {"error": str(e)}


def sanctions_lookup(
    target: str,
    policy_ref: str,
    authorization_ref: str,
    target_scope: str,
    operator_identity_ref: str,
    receipt_sink: str,
    fixture_mode: bool = False,
    schema: str = "Thing",
) -> dict:
    req = EngagementRequest(
        lookup_type="whois",  # passive public-source identity matching
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
    record_id = f"osint-passive-sanctions-{uuid.uuid4().hex[:8]}"

    if not decision.authorized:
        result = build_denial_record(req, decision)
        result["lookupId"] = record_id
        result["lookupType"] = "sanctions"
        _emit_receipt(result, receipt_sink)
        return result

    if fixture_mode or target_scope == "fixture_only":
        data = FIXTURE_SANCTIONS.get(target, FIXTURE_SANCTIONS["John Doe"])
        network_boundary, status = "no_external_contact", "fixture_only"
    else:
        data = _opensanctions_live(target, schema)
        network_boundary = "public_source_api_only"
        if "error" in data:
            status = "error"
        elif data.get("total", 0) == 0:
            status = "not_found"
        else:
            status = "success"

    result = {
        "schemaVersion": "0.1.0",
        "lookupId": record_id,
        "lookupType": "sanctions",
        "target": target,
        "targetScope": req.target_scope,
        "engagementPolicyRef": policy_ref,
        "authorizationRef": authorization_ref,
        "executionMode": req.execution_mode,
        "nonDestructiveOnly": True,
        "networkBoundary": network_boundary,
        "sourceEvidenceRef": "OpenSanctions consolidated dataset (OFAC/UN/EU/INTERPOL and ~40 sources)",
        "operatorIdentityRef": operator_identity_ref,
        "receiptRequired": True,
        "fixtureMode": fixture_mode,
        "result": {
            "status": status,
            "records": [data],
            "confidenceCaveat": "SANCTIONS MATCH IS NOT CONCLUSIVE. Common names carry high false-positive risk. All matches require human analyst review before any operational use. OpenSanctions commercial use requires a license.",
        },
        "receiptEmitted": False,
        "queriedAt": datetime.now(timezone.utc).isoformat(),
        "actionAuthorizedReceipt": "gate_passed",
        "warnings": decision.warnings + [
            "Sanctions results must be reviewed by a qualified analyst. False positives are common for common names."
        ],
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
    ap = argparse.ArgumentParser(description="SCOPE-D passive sanctions/watchlist matching")
    ap.add_argument("--target", required=True, help="Name or entity to match")
    ap.add_argument("--schema", default="Thing", help="OpenSanctions schema (Person, Company, Thing)")
    ap.add_argument("--policy", default=""); ap.add_argument("--auth", default="")
    ap.add_argument("--scope", default="fixture_only"); ap.add_argument("--operator", default="michael@socioprophet.ai")
    ap.add_argument("--receipt-sink", default="raw/osint_receipts.jsonl")
    ap.add_argument("--fixture", action="store_true"); ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    result = sanctions_lookup(args.target, args.policy, args.auth, args.scope, args.operator, args.receipt_sink, args.fixture, args.schema)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        recs = result["result"].get("records", [])
        print(f"Sanctions: '{args.target}' → {result['result']['status']}")
        for r in recs:
            hits = r.get("results", [])
            print(f"  matches: {len(hits)}")
            for h in hits[:3]:
                print(f"    score={h.get('score','?'):.2f}  {h.get('caption','?')}  [{', '.join(h.get('datasets',[]))}]")
        print(f"  [!] Review required before any operational use")


if __name__ == "__main__":
    main()
