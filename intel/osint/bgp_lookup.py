#!/usr/bin/env python3
"""Passive BGP/ASN lookup — SCOPE-D OSINT passive lookup lane.

Queries Team Cymru's IP-to-ASN mapping service via whois (port 43, TCP).
Derives AS number, AS name, and BGP prefix for an IP address.
No active probing, no port scan beyond the whois protocol.
Risk class: low (public BGP table data only).

EngagementPolicy gate enforced before any external contact.

Usage:
  python intel/osint/bgp_lookup.py --target 8.8.8.8 \
    --policy engagement-policy-research \
    --auth "public_research: rfc8805" \
    --scope public_research_no_pii \
    --operator michael@socioprophet.ai \
    --receipt-sink raw/osint_receipts.jsonl

  # Fixture mode (no live contact):
  python intel/osint/bgp_lookup.py --target 192.0.2.1 --fixture
"""
import argparse
import json
import socket
import uuid
from datetime import datetime, timezone
from pathlib import Path

from validate_engagement_policy import EngagementRequest, build_denial_record, check_engagement_policy

CYMRU_WHOIS_HOST = "whois.cymru.com"
CYMRU_WHOIS_PORT = 43

FIXTURE_BGP = {
    "192.0.2.1": {
        "asn": "64496",
        "as_name": "FIXTURE-ASN (fictional, RFC 5398)",
        "prefix": "192.0.2.0/24",
        "country": "US",
        "registry": "ARIN",
        "source": "fixture",
    },
    "198.51.100.1": {
        "asn": "64497",
        "as_name": "FIXTURE-ASN-2 (fictional, RFC 5737)",
        "prefix": "198.51.100.0/24",
        "country": "US",
        "registry": "ARIN",
        "source": "fixture",
    },
}

_CYMRU_QUERY = "begin\nverbose\n{ip}\nend\n"


def _cymru_whois(ip: str) -> dict:
    try:
        with socket.create_connection((CYMRU_WHOIS_HOST, CYMRU_WHOIS_PORT), timeout=15) as sock:
            sock.sendall(_CYMRU_QUERY.format(ip=ip).encode())
            buf = b""
            while True:
                chunk = sock.recv(4096)
                if not chunk:
                    break
                buf += chunk
        lines = [l.strip() for l in buf.decode(errors="replace").splitlines() if l.strip()]
        for line in lines:
            if line.startswith("AS"):
                parts = [p.strip() for p in line.split("|")]
                if len(parts) >= 5:
                    return {
                        "asn": parts[0].lstrip("AS"),
                        "prefix": parts[1],
                        "country": parts[2],
                        "registry": parts[3],
                        "allocated": parts[4] if len(parts) > 4 else "",
                        "as_name": parts[5] if len(parts) > 5 else "",
                        "source": "team_cymru_whois",
                    }
        return {"raw": buf.decode(errors="replace"), "source": "team_cymru_whois", "parse_error": "unexpected format"}
    except Exception as e:
        return {"error": str(e)}


def bgp_lookup(
    target: str,
    policy_ref: str,
    authorization_ref: str,
    target_scope: str,
    operator_identity_ref: str,
    receipt_sink: str,
    fixture_mode: bool = False,
) -> dict:
    req = EngagementRequest(
        lookup_type="bgp",
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
    record_id = f"osint-passive-bgp-{uuid.uuid4().hex[:8]}"

    if not decision.authorized:
        result = build_denial_record(req, decision)
        result["lookupId"] = record_id
        _emit_receipt(result, receipt_sink)
        return result

    if fixture_mode or target_scope == "fixture_only":
        data = FIXTURE_BGP.get(target, FIXTURE_BGP["192.0.2.1"])
        network_boundary = "no_external_contact"
        status = "fixture_only"
        records = [data]
    else:
        data = _cymru_whois(target)
        network_boundary = "public_source_api_only"
        if "error" in data:
            status = "error"
        elif data:
            status = "success"
        else:
            status = "not_found"
        records = [data]

    result = {
        "schemaVersion": "0.1.0",
        "lookupId": record_id,
        "lookupType": "bgp",
        "target": target,
        "targetScope": req.target_scope,
        "engagementPolicyRef": policy_ref,
        "authorizationRef": authorization_ref,
        "executionMode": req.execution_mode,
        "nonDestructiveOnly": True,
        "networkBoundary": network_boundary,
        "sourceEvidenceRef": "Team Cymru IP-to-ASN whois service (public BGP table)",
        "operatorIdentityRef": operator_identity_ref,
        "receiptRequired": True,
        "fixtureMode": fixture_mode,
        "result": {
            "status": status,
            "records": records,
            "confidenceCaveat": "BGP table data reflects routing state at query time. Prefix/ASN may have changed. No active probing was performed — data source is Team Cymru public whois.",
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
    ap = argparse.ArgumentParser(description="SCOPE-D passive BGP/ASN lookup (Team Cymru)")
    ap.add_argument("--target", required=True, help="IP address to look up")
    ap.add_argument("--policy", default="")
    ap.add_argument("--auth", default="")
    ap.add_argument("--scope", default="fixture_only")
    ap.add_argument("--operator", default="michael@socioprophet.ai")
    ap.add_argument("--receipt-sink", default="raw/osint_receipts.jsonl")
    ap.add_argument("--fixture", action="store_true")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    result = bgp_lookup(
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
        recs = result["result"].get("records", [])
        print(f"BGP: {args.target} → {result['result']['status']}")
        for r in recs:
            if "error" in r:
                print(f"  error: {r['error']}")
            else:
                print(f"  ASN:    AS{r.get('asn','?')}")
                print(f"  name:   {r.get('as_name','?')}")
                print(f"  prefix: {r.get('prefix','?')}")
                print(f"  cc:     {r.get('country','?')}  registry: {r.get('registry','?')}")


if __name__ == "__main__":
    main()
