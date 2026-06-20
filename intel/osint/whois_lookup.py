#!/usr/bin/env python3
"""Passive WHOIS lookup — SCOPE-D OSINT passive lookup lane.

Queries IANA/ARIN WHOIS via the `python-whois` library. No active probing,
no port scanning. Risk class: low (public registration data only).

EngagementPolicy gate enforced before any external contact.

Usage:
  python intel/osint/whois_lookup.py --target socioprophet.ai \
    --policy engagement-policy-owned-infra \
    --auth "owner: michael@socioprophet.ai" \
    --scope owned_infrastructure \
    --operator michael@socioprophet.ai \
    --receipt-sink raw/osint_receipts.jsonl

  # Fixture mode (no live contact):
  python intel/osint/whois_lookup.py --target fixture.example --fixture
"""
import argparse
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from validate_engagement_policy import EngagementRequest, build_denial_record, check_engagement_policy

FIXTURE_WHOIS = {
    "fixture.example": {
        "registrar": "Fixture Registrar, Inc.",
        "creation_date": "2000-01-01T00:00:00Z",
        "expiration_date": "2030-01-01T00:00:00Z",
        "updated_date": "2023-06-01T00:00:00Z",
        "name_servers": ["ns1.fixture.example", "ns2.fixture.example"],
        "status": ["clientTransferProhibited"],
        "registrant_org": "Fixture Corp",
        "dnssec": "unsigned",
    }
}


def _whois_live(target: str) -> dict:
    try:
        import whois  # python-whois
        w = whois.whois(target)
        def _ser(v):
            if isinstance(v, list):
                return [_ser(i) for i in v]
            if hasattr(v, "isoformat"):
                return v.isoformat()
            return v
        return {k: _ser(v) for k, v in w.items() if v is not None}
    except ImportError:
        return {"error": "python-whois not installed — pip install python-whois"}
    except Exception as e:
        return {"error": str(e)}


def whois_lookup(
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
    record_id = f"osint-passive-whois-{uuid.uuid4().hex[:8]}"

    if not decision.authorized:
        result = build_denial_record(req, decision)
        result["lookupId"] = record_id
        _emit_receipt(result, receipt_sink)
        return result

    if fixture_mode or target_scope == "fixture_only":
        data = FIXTURE_WHOIS.get(target, FIXTURE_WHOIS["fixture.example"])
        network_boundary = "no_external_contact"
        status = "fixture_only"
        records = [data]
    else:
        data = _whois_live(target)
        network_boundary = "public_source_api_only"
        status = "error" if "error" in data else "success"
        records = [data] if data else []

    result = {
        "schemaVersion": "0.1.0",
        "lookupId": record_id,
        "lookupType": "whois",
        "target": target,
        "targetScope": req.target_scope,
        "engagementPolicyRef": policy_ref,
        "authorizationRef": authorization_ref,
        "executionMode": req.execution_mode,
        "nonDestructiveOnly": True,
        "networkBoundary": network_boundary,
        "sourceEvidenceRef": "IANA/ARIN WHOIS (python-whois, passive query)",
        "operatorIdentityRef": operator_identity_ref,
        "receiptRequired": True,
        "fixtureMode": fixture_mode,
        "result": {
            "status": status,
            "records": records,
            "confidenceCaveat": "WHOIS data reflects registry state at query time. Registrant PII may be redacted (GDPR). No port scan or active probe performed.",
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
    ap = argparse.ArgumentParser(description="SCOPE-D passive WHOIS lookup")
    ap.add_argument("--target", required=True)
    ap.add_argument("--policy", default="")
    ap.add_argument("--auth", default="")
    ap.add_argument("--scope", default="fixture_only")
    ap.add_argument("--operator", default="michael@socioprophet.ai")
    ap.add_argument("--receipt-sink", default="raw/osint_receipts.jsonl")
    ap.add_argument("--fixture", action="store_true")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    result = whois_lookup(
        target=args.target,
        policy_ref=args.policy,
        authorization_ref=args.auth,
        target_scope=args.scope,
        operator_identity_ref=args.operator,
        receipt_sink=args.receipt_sink,
        fixture_mode=args.fixture,
    )

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"WHOIS: {args.target} → {result['result']['status']}")
        for r in result["result"].get("records", []):
            for k, v in r.items():
                if k != "error":
                    print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
