#!/usr/bin/env python3
"""Passive DNS lookup — SCOPE-D OSINT passive lookup lane.

Public-source resolution via the system DNS resolver. No active probing,
no zone transfer, no subdomain brute-force. Risk class: medium.

EngagementPolicy gate enforced before any external contact.

Usage:
  python intel/osint/dns_lookup.py --target example.com \
    --policy engagement-policy-owned-infra \
    --auth "owner: michael@socioprophet.ai" \
    --scope owned_infrastructure \
    --operator michael@socioprophet.ai \
    --receipt-sink raw/osint_receipts.jsonl

  # Fixture mode (no live contact):
  python intel/osint/dns_lookup.py --target fixture.example --fixture

See: docs/osiris-recon-capability-recovery-backlog.md §4 (DNS lookup, medium risk)
"""
import argparse
import json
import socket
import uuid
from datetime import datetime, timezone
from pathlib import Path

from validate_engagement_policy import EngagementRequest, GateDecision, build_denial_record, check_engagement_policy

FIXTURE_RECORDS = {
    "fixture.example": [
        {"type": "A",    "value": "192.0.2.1",   "ttl": 300},
        {"type": "AAAA", "value": "2001:db8::1",  "ttl": 300},
        {"type": "MX",   "value": "10 mail.fixture.example", "ttl": 3600},
    ]
}


def _resolve_live(target: str) -> list[dict]:
    records = []
    # A + AAAA via getaddrinfo
    try:
        infos = socket.getaddrinfo(target, None)
        seen = set()
        for family, _, _, _, sockaddr in infos:
            ip = sockaddr[0]
            if ip not in seen:
                seen.add(ip)
                rtype = "A" if family == socket.AF_INET else "AAAA"
                records.append({"type": rtype, "value": ip})
    except socket.gaierror as e:
        records.append({"type": "error", "value": str(e)})
    # PTR (reverse DNS)
    for r in list(records):
        if r["type"] in ("A", "AAAA"):
            try:
                ptr = socket.gethostbyaddr(r["value"])[0]
                records.append({"type": "PTR", "value": ptr, "for": r["value"]})
            except Exception:
                pass
    return records


def dns_lookup(
    target: str,
    policy_ref: str,
    authorization_ref: str,
    target_scope: str,
    operator_identity_ref: str,
    receipt_sink: str,
    fixture_mode: bool = False,
) -> dict:
    req = EngagementRequest(
        lookup_type="dns",
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

    record_id = f"osint-passive-dns-{uuid.uuid4().hex[:8]}"

    if not decision.authorized:
        result = build_denial_record(req, decision)
        result["lookupId"] = record_id
        _emit_receipt(result, receipt_sink)
        return result

    if fixture_mode or target_scope == "fixture_only":
        records = FIXTURE_RECORDS.get(target, [{"type": "A", "value": "192.0.2.1", "ttl": 300}])
        network_boundary = "no_external_contact"
        status = "fixture_only"
    else:
        records = _resolve_live(target)
        network_boundary = "public_dns_only"
        status = "success" if any(r.get("type") not in ("error",) for r in records) else "error"

    result = {
        "schemaVersion": "0.1.0",
        "lookupId": record_id,
        "lookupType": "dns",
        "target": target,
        "targetScope": req.target_scope,
        "engagementPolicyRef": policy_ref,
        "authorizationRef": authorization_ref,
        "executionMode": req.execution_mode,
        "nonDestructiveOnly": True,
        "networkBoundary": network_boundary,
        "sourceEvidenceRef": "system DNS resolver (passive resolution only)",
        "operatorIdentityRef": operator_identity_ref,
        "receiptRequired": True,
        "fixtureMode": fixture_mode,
        "result": {
            "status": status,
            "records": records,
            "confidenceCaveat": "Passive DNS resolution only. Results reflect current resolver state; not authoritative. No zone transfer or brute-force performed.",
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
    ap = argparse.ArgumentParser(description="SCOPE-D passive DNS lookup")
    ap.add_argument("--target", required=True, help="Domain or IP to look up")
    ap.add_argument("--policy", default="", help="EngagementPolicy ref")
    ap.add_argument("--auth", default="", help="AuthorizationRef")
    ap.add_argument("--scope", default="fixture_only", help="TargetScope")
    ap.add_argument("--operator", default="michael@socioprophet.ai", help="OperatorIdentityRef")
    ap.add_argument("--receipt-sink", default="raw/osint_receipts.jsonl", help="Receipt output path")
    ap.add_argument("--fixture", action="store_true", help="Fixture mode — no live network contact")
    ap.add_argument("--json", action="store_true", help="Output JSON")
    args = ap.parse_args()

    result = dns_lookup(
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
        status = result["result"]["status"]
        print(f"DNS lookup: {args.target} → {status}")
        for r in result["result"].get("records", []):
            print(f"  {r.get('type'):6} {r.get('value')}")
        if result.get("warnings"):
            for w in result["warnings"]:
                print(f"  [warn] {w}")
        print(f"  Receipt: {args.receipt_sink}")


if __name__ == "__main__":
    main()
