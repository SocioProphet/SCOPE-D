#!/usr/bin/env python3
"""Passive breach/leak reference lookup — SCOPE-D OSINT passive lookup lane.

Queries Have I Been Pwned (HIBP) API for:
  - /breachedaccount/<email>  — which breaches an email appeared in
  - /breaches?domain=<domain> — which breaches a domain was involved in
  - /pasteaccount/<email>     — pastes referencing an email

Returns breach metadata only: name, domain, breach date, data classes
compromised. NEVER returns passwords, hashes, or credential content.

API key required: HIBP_API_KEY env var (https://haveibeenpwned.com/API/Key).
Fixture mode always available without key.

Legal hold resolved: operator authorization 2026-06-20.
Gate: EngagementPolicy + scope + no-credential boundary + receipt.

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

HIBP_BASE      = "https://haveibeenpwned.com/api/v3"
HIBP_ACCOUNT   = HIBP_BASE + "/breachedaccount/{email}?truncateResponse=false"
HIBP_DOMAIN    = HIBP_BASE + "/breaches?domain={domain}"
HIBP_PASTES    = HIBP_BASE + "/pasteaccount/{email}"

EMAIL_RE  = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
DOMAIN_RE = re.compile(r"^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$")

FIXTURE_BREACHES = {
    "user@fixture.example": {
        "target": "user@fixture.example",
        "mode": "email",
        "breaches": [
            {
                "Name": "FixtureBreach2023",
                "Domain": "fixture.example",
                "BreachDate": "2023-01-15",
                "AddedDate": "2023-03-01T00:00:00Z",
                "DataClasses": ["Email addresses", "Passwords", "Usernames"],
                "IsSensitive": False,
                "IsVerified": True,
                "PwnCount": 500000,
            }
        ],
        "pastes": [],
        "source": "fixture",
    },
    "fixture.example": {
        "target": "fixture.example",
        "mode": "domain",
        "breaches": [
            {
                "Name": "FixtureBreach2023",
                "Domain": "fixture.example",
                "BreachDate": "2023-01-15",
                "DataClasses": ["Email addresses", "Passwords"],
                "PwnCount": 500000,
                "IsVerified": True,
            }
        ],
        "source": "fixture",
    },
}


def _hibp_headers() -> dict:
    key = os.environ.get("HIBP_API_KEY", "")
    hdrs = {
        "User-Agent": "SCOPE-D/0.1 passive-breach-lookup",
        "Accept": "application/json",
    }
    if key:
        hdrs["hibp-api-key"] = key
    return hdrs


def _hibp_get(url: str) -> list | dict | None:
    try:
        req = urllib.request.Request(url, headers=_hibp_headers())
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return []
        if e.code == 401:
            return {"error": "HIBP_API_KEY required. Set env var: export HIBP_API_KEY=<key>"}
        if e.code == 429:
            return {"error": "HIBP rate limit exceeded. Wait and retry."}
        return {"error": f"HTTP {e.code}"}
    except Exception as e:
        return {"error": str(e)}


def _safe_breach_record(b: dict) -> dict:
    return {
        "Name": b.get("Name", ""),
        "Domain": b.get("Domain", ""),
        "BreachDate": b.get("BreachDate", ""),
        "AddedDate": b.get("AddedDate", ""),
        "ModifiedDate": b.get("ModifiedDate", ""),
        "PwnCount": b.get("PwnCount", 0),
        "DataClasses": b.get("DataClasses", []),
        "IsVerified": b.get("IsVerified", False),
        "IsSensitive": b.get("IsSensitive", False),
        "IsFabricated": b.get("IsFabricated", False),
        "IsRetired": b.get("IsRetired", False),
    }


def breach_lookup(
    target: str,
    policy_ref: str,
    authorization_ref: str,
    target_scope: str,
    operator_identity_ref: str,
    receipt_sink: str,
    fixture_mode: bool = False,
    include_pastes: bool = False,
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
    record_id = f"osint-passive-breach-{uuid.uuid4().hex[:8]}"

    if not decision.authorized:
        result = build_denial_record(req, decision)
        result["lookupId"] = record_id
        result["lookupType"] = "breach"
        _emit_receipt(result, receipt_sink)
        return result

    is_email  = bool(EMAIL_RE.match(target))
    is_domain = bool(DOMAIN_RE.match(target)) and not is_email
    mode = "email" if is_email else "domain" if is_domain else None

    if mode is None:
        data = {"error": f"Target '{target}' is neither a valid email nor domain."}
        status, network_boundary = "error", "no_external_contact"
    elif fixture_mode or target_scope == "fixture_only":
        data = FIXTURE_BREACHES.get(target, FIXTURE_BREACHES["user@fixture.example"])
        status, network_boundary = "fixture_only", "no_external_contact"
    else:
        if is_email:
            raw = _hibp_get(HIBP_ACCOUNT.format(email=urllib.parse.quote(target)))
            pastes = _hibp_get(HIBP_PASTES.format(email=urllib.parse.quote(target))) if include_pastes else []
            if isinstance(raw, dict) and "error" in raw:
                data = raw; status = "error"
            else:
                data = {
                    "target": target,
                    "mode": "email",
                    "breaches": [_safe_breach_record(b) for b in (raw or [])],
                    "pastes": pastes if isinstance(pastes, list) else [],
                    "source": "hibp_v3",
                }
                status = "success" if (raw or pastes) else "not_found"
        else:
            raw = _hibp_get(HIBP_DOMAIN.format(domain=target))
            if isinstance(raw, dict) and "error" in raw:
                data = raw; status = "error"
            else:
                data = {
                    "target": target,
                    "mode": "domain",
                    "breaches": [_safe_breach_record(b) for b in (raw or [])],
                    "source": "hibp_v3",
                }
                status = "success" if raw else "not_found"
        network_boundary = "public_source_api_only"

    import urllib.parse

    result = {
        "schemaVersion": "0.1.0",
        "lookupId": record_id,
        "lookupType": "breach",
        "target": target,
        "targetScope": req.target_scope,
        "engagementPolicyRef": policy_ref,
        "authorizationRef": authorization_ref,
        "executionMode": req.execution_mode,
        "nonDestructiveOnly": True,
        "networkBoundary": network_boundary,
        "sourceEvidenceRef": "Have I Been Pwned API v3 (breach metadata only, no credential content)",
        "operatorIdentityRef": operator_identity_ref,
        "receiptRequired": True,
        "fixtureMode": fixture_mode,
        "result": {
            "status": status,
            "records": [data] if isinstance(data, dict) else [],
            "confidenceCaveat": "Breach metadata only. No passwords, no hashes, no credential content returned or stored. HIBP data reflects breach disclosures at index time — coverage is not exhaustive.",
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
    ap = argparse.ArgumentParser(description="SCOPE-D passive breach/leak reference lookup (HIBP, metadata only)")
    ap.add_argument("--target", required=True, help="Email address or domain")
    ap.add_argument("--include-pastes", action="store_true", help="Also query HIBP paste index (email only)")
    ap.add_argument("--policy", default=""); ap.add_argument("--auth", default="")
    ap.add_argument("--scope", default="fixture_only"); ap.add_argument("--operator", default="michael@socioprophet.ai")
    ap.add_argument("--receipt-sink", default="raw/osint_receipts.jsonl")
    ap.add_argument("--fixture", action="store_true"); ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    result = breach_lookup(args.target, args.policy, args.auth, args.scope, args.operator,
                           args.receipt_sink, args.fixture, args.include_pastes)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        recs = result["result"].get("records", [])
        print(f"Breach: {args.target} → {result['result']['status']}")
        for r in recs:
            breaches = r.get("breaches", [])
            print(f"  breaches: {len(breaches)}")
            for b in breaches[:5]:
                print(f"    {b['BreachDate']}  {b['Name']} ({b['Domain']})  "
                      f"pwned={b['PwnCount']:,}  data={b['DataClasses']}")


if __name__ == "__main__":
    main()
