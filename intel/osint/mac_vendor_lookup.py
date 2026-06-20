#!/usr/bin/env python3
"""Passive MAC vendor lookup — SCOPE-D OSINT passive lookup lane.

Queries maclookup.app JSON mirror of the IEEE MA-L OUI registry to resolve
a MAC prefix to its registered manufacturer. No device contact, no ARP,
no network probe. Risk class: low/medium. Privacy: none (vendor only).

Caches the full OUI DB to /tmp for 7 days to minimize external calls.

EngagementPolicy gate enforced before any external contact.
"""
import argparse
import json
import re
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

from validate_engagement_policy import EngagementRequest, build_denial_record, check_engagement_policy

IEEE_MA_L_URL = "https://maclookup.app/downloads/json-database/get-db"

FIXTURE_VENDORS = {
    "001A2B": {"vendor": "Fixture Systems Inc.", "address": "1 Fixture St, Testville, US", "source": "fixture"},
    "005056": {"vendor": "VMware, Inc.", "address": "3401 Hillview Ave, Palo Alto, CA, US", "source": "fixture"},
    "000C29": {"vendor": "VMware, Inc.", "address": "3401 Hillview Ave, Palo Alto, CA, US", "source": "fixture"},
}

_oui_cache: dict | None = None
_CACHE_FILE = Path("/tmp/scopd_mac_oui_cache.json")
_CACHE_TTL_SECONDS = 86400 * 7


def _normalize_prefix(mac: str) -> str:
    return re.sub(r"[^0-9A-Fa-f]", "", mac).upper()[:6]


def _load_or_fetch_db() -> dict:
    global _oui_cache
    if _oui_cache is not None:
        return _oui_cache
    if _CACHE_FILE.exists():
        age = datetime.now().timestamp() - _CACHE_FILE.stat().st_mtime
        if age < _CACHE_TTL_SECONDS:
            with open(_CACHE_FILE) as f:
                _oui_cache = json.load(f)
            return _oui_cache
    try:
        req = urllib.request.Request(
            IEEE_MA_L_URL,
            headers={"Accept": "application/json", "User-Agent": "SCOPE-D/0.1 passive-mac-lookup"},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
        db = {}
        for entry in data:
            prefix = _normalize_prefix(entry.get("macPrefix", ""))
            if prefix:
                db[prefix] = {
                    "vendor": entry.get("vendorName", ""),
                    "address": entry.get("vendorAddress", ""),
                    "source": "ieee_ma_l",
                }
        _CACHE_FILE.write_text(json.dumps(db))
        _oui_cache = db
        return db
    except Exception as e:
        return {"_error": str(e)}


def mac_vendor_lookup(
    target: str,
    policy_ref: str,
    authorization_ref: str,
    target_scope: str,
    operator_identity_ref: str,
    receipt_sink: str,
    fixture_mode: bool = False,
) -> dict:
    req = EngagementRequest(
        lookup_type="mac_vendor",
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
    record_id = f"osint-passive-mac_vendor-{uuid.uuid4().hex[:8]}"

    if not decision.authorized:
        result = build_denial_record(req, decision)
        result["lookupId"] = record_id
        _emit_receipt(result, receipt_sink)
        return result

    prefix = _normalize_prefix(target)

    if fixture_mode or target_scope == "fixture_only":
        data = FIXTURE_VENDORS.get(prefix, {"vendor": "Unknown (fixture)", "address": "", "source": "fixture"})
        network_boundary, status = "no_external_contact", "fixture_only"
    else:
        db = _load_or_fetch_db()
        if "_error" in db:
            data = {"error": db["_error"]}
            network_boundary, status = "public_source_api_only", "error"
        else:
            data = db.get(prefix, {"vendor": "Unknown", "address": "", "source": "ieee_ma_l"})
            network_boundary = "public_source_api_only"
            status = "success" if data.get("vendor") not in ("", "Unknown") else "not_found"

    result = {
        "schemaVersion": "0.1.0",
        "lookupId": record_id,
        "lookupType": "mac_vendor",
        "target": target,
        "targetScope": req.target_scope,
        "engagementPolicyRef": policy_ref,
        "authorizationRef": authorization_ref,
        "executionMode": req.execution_mode,
        "nonDestructiveOnly": True,
        "networkBoundary": network_boundary,
        "sourceEvidenceRef": "IEEE MA-L OUI registry (maclookup.app JSON mirror, public)",
        "operatorIdentityRef": operator_identity_ref,
        "receiptRequired": True,
        "fixtureMode": fixture_mode,
        "result": {
            "status": status,
            "records": [{"prefix": prefix, **data}],
            "confidenceCaveat": "OUI prefix resolves to registered manufacturer only. MACs can be spoofed; this is vendor context, not device identity. No network probe performed.",
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
    ap = argparse.ArgumentParser(description="SCOPE-D passive MAC vendor lookup (IEEE OUI)")
    ap.add_argument("--target", required=True, help="MAC address or OUI prefix (e.g. 00:1A:2B or 00:1A:2B:3C:4D:5E)")
    ap.add_argument("--policy", default=""); ap.add_argument("--auth", default="")
    ap.add_argument("--scope", default="fixture_only"); ap.add_argument("--operator", default="michael@socioprophet.ai")
    ap.add_argument("--receipt-sink", default="raw/osint_receipts.jsonl")
    ap.add_argument("--fixture", action="store_true"); ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    result = mac_vendor_lookup(args.target, args.policy, args.auth, args.scope, args.operator, args.receipt_sink, args.fixture)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        for r in result["result"].get("records", []):
            print(f"MAC vendor: {args.target}  →  {r.get('vendor','?')}  [{r.get('address','')}]")


if __name__ == "__main__":
    main()
