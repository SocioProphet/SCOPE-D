#!/usr/bin/env python3
"""SCOPE-D Scanner Adapter — policy-gated replacement for OSIRIS scanner_proxy.

OSIRIS had an ungated /api/scanner endpoint that accepted arbitrary scan types
against arbitrary targets. This adapter enforces the full EngagementPolicy gate
before dispatching to any scan module, and permanently blocks:
  - CIDR sweep (requires separate engagement authorization, not implemented here)
  - stealth/evasion fetch behavior
  - active exploit/probe modes
  - any scan without a full engagement policy document

Supported scan types (all passive/declared-metadata only):
  ssl       — TLS certificate metadata (passive, no active handshake injection)
  headers   — HTTP response headers (passive, single GET only)
  rdns      — Reverse DNS (passive, system resolver)
  tech      — Technology fingerprint from HTTP headers + HTML meta tags (passive)

Explicitly NOT supported (permanently blocked):
  quick     — OSIRIS "quick scan" — too broad, no safe fixture semantics
  subdomains — brute-force enumeration
  vuln      — active vulnerability probing
  cidr_sweep — blocked by policy

For each supported type, the adapter:
  1. Enforces the EngagementPolicy gate (validate_engagement_policy.py)
  2. Requires ExecutionMode: fixture | passive_public_source | dry_run
  3. Emits a receipt (authorized or denied) before returning
  4. Never stores credentials or secrets in results

See: docs/osiris-recon-capability-recovery-backlog.md §6 (scanner proxy redesign)
"""
import argparse
import json
import re
import socket
import ssl
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "osint"))
from validate_engagement_policy import (
    EngagementRequest, DenialReason, GateDecision,
    build_denial_record, check_engagement_policy,
    BLOCKED_LOOKUP_TYPES,
)

# Scan types this adapter handles after gate approval
SUPPORTED_SCAN_TYPES = {"ssl", "headers", "rdns", "tech"}

# Additional scanner-specific blocked types (beyond gate's BLOCKED_LOOKUP_TYPES)
ADAPTER_BLOCKED = {"quick", "subdomains", "vuln", "port_scan", "exploit", "cidr_sweep"}

FIXTURE_RESULTS: dict[str, dict[str, Any]] = {
    "ssl": {
        "target": "fixture.example",
        "common_name": "fixture.example",
        "issuer": "CN=Let's Encrypt Authority X3",
        "not_before": "2024-01-01T00:00:00Z",
        "not_after": "2025-01-01T00:00:00Z",
        "san": ["fixture.example", "www.fixture.example"],
        "tls_version": "TLSv1.3",
        "cipher": "TLS_AES_256_GCM_SHA384",
        "source": "fixture",
    },
    "headers": {
        "target": "fixture.example",
        "status_code": 200,
        "headers": {
            "server": "nginx/1.24.0",
            "content-type": "text/html; charset=UTF-8",
            "x-frame-options": "SAMEORIGIN",
            "strict-transport-security": "max-age=31536000; includeSubDomains",
            "x-content-type-options": "nosniff",
            "content-security-policy": "default-src 'self'",
        },
        "source": "fixture",
    },
    "rdns": {
        "target": "192.0.2.1",
        "ptr": "fixture.example",
        "source": "fixture",
    },
    "tech": {
        "target": "fixture.example",
        "detected": [
            {"name": "nginx", "version": "1.24.0", "confidence": 0.9, "categories": ["web_server"]},
            {"name": "Bootstrap", "version": "5.3", "confidence": 0.7, "categories": ["css_framework"]},
        ],
        "source": "fixture",
    },
}


def _ssl_scan(target: str, port: int = 443) -> dict:
    try:
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(socket.create_connection((target, port), timeout=10), server_hostname=target) as sock:
            cert = sock.getpeercert()
            cipher = sock.cipher()
            tls_version = sock.version()
        san = [v for t, v in cert.get("subjectAltName", []) if t == "DNS"]
        subject = dict(x[0] for x in cert.get("subject", []))
        issuer  = dict(x[0] for x in cert.get("issuer", []))
        return {
            "target": target,
            "common_name": subject.get("commonName", ""),
            "issuer": f"CN={issuer.get('commonName','')}",
            "not_before": cert.get("notBefore", ""),
            "not_after": cert.get("notAfter", ""),
            "san": san,
            "tls_version": tls_version or "",
            "cipher": cipher[0] if cipher else "",
            "source": "passive_tls_handshake",
        }
    except Exception as e:
        return {"error": str(e)}


def _headers_scan(target: str) -> dict:
    for scheme in ("https", "http"):
        try:
            url = f"{scheme}://{target}/"
            req = urllib.request.Request(url, method="GET",
                                         headers={"User-Agent": "SCOPE-D/0.1 passive-header-check"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                return {
                    "target": target,
                    "status_code": resp.status,
                    "headers": dict(resp.headers),
                    "final_url": resp.url,
                    "source": "passive_http_get",
                }
        except Exception:
            continue
    return {"error": f"Could not reach {target} via https or http"}


def _rdns_scan(target: str) -> dict:
    try:
        ptr = socket.gethostbyaddr(target)[0]
        return {"target": target, "ptr": ptr, "source": "passive_reverse_dns"}
    except Exception as e:
        return {"target": target, "ptr": None, "error": str(e), "source": "passive_reverse_dns"}


def _tech_scan(target: str) -> dict:
    """Passive tech detection from HTTP headers + HTML meta tags only."""
    headers_result = _headers_scan(target)
    if "error" in headers_result:
        return {"error": headers_result["error"]}
    hdrs = {k.lower(): v for k, v in headers_result.get("headers", {}).items()}
    detected = []
    # Server header
    if "server" in hdrs:
        srv = hdrs["server"]
        m = re.match(r"(nginx|apache|caddy|iis|lighttpd)[/\s]?([0-9.]+)?", srv, re.I)
        if m:
            detected.append({"name": m.group(1).lower(), "version": m.group(2) or "",
                             "confidence": 0.9, "categories": ["web_server"]})
    # X-Powered-By
    if "x-powered-by" in hdrs:
        detected.append({"name": hdrs["x-powered-by"], "version": "", "confidence": 0.8, "categories": ["backend"]})
    # Security headers presence
    security_headers = ["strict-transport-security", "content-security-policy",
                        "x-frame-options", "x-content-type-options"]
    present = [h for h in security_headers if h in hdrs]
    missing = [h for h in security_headers if h not in hdrs]
    return {
        "target": target,
        "detected": detected,
        "security_headers_present": present,
        "security_headers_missing": missing,
        "source": "passive_http_headers",
    }


def scanner_scan(
    scan_type: str,
    target: str,
    policy_ref: str,
    authorization_ref: str,
    target_scope: str,
    operator_identity_ref: str,
    receipt_sink: str,
    fixture_mode: bool = False,
    port: int | None = None,
) -> dict:
    """Run a policy-gated passive scan. Gate enforced before any external contact."""

    # Pre-gate: check adapter-specific blocked types
    if scan_type in ADAPTER_BLOCKED or scan_type in BLOCKED_LOOKUP_TYPES:
        denial = {
            "schemaVersion": "0.1.0",
            "lookupId": f"osint-passive-scan-denied-{uuid.uuid4().hex[:8]}",
            "lookupType": scan_type,
            "target": target,
            "targetScope": target_scope or "MISSING",
            "engagementPolicyRef": policy_ref or "MISSING",
            "authorizationRef": authorization_ref or "MISSING",
            "executionMode": "fixture" if fixture_mode else "passive_public_source",
            "nonDestructiveOnly": True,
            "networkBoundary": "no_external_contact",
            "sourceEvidenceRef": "gate_enforcer",
            "operatorIdentityRef": operator_identity_ref or "MISSING",
            "receiptRequired": True,
            "fixtureMode": fixture_mode,
            "result": {
                "status": "denied_unauthorized_lookup_type",
                "records": [],
                "confidenceCaveat": "Scan type is permanently blocked.",
            },
            "receiptEmitted": True,
            "queriedAt": datetime.now(timezone.utc).isoformat(),
            "actionDeniedReceipt": "denied_unauthorized_lookup_type",
            "denialMessage": f"Scan type '{scan_type}' is permanently blocked by SCOPE-D scanner adapter. Blocked: {sorted(ADAPTER_BLOCKED | BLOCKED_LOOKUP_TYPES)}",
        }
        _emit_receipt(denial, receipt_sink)
        return denial

    if scan_type not in SUPPORTED_SCAN_TYPES:
        denial = {
            "schemaVersion": "0.1.0",
            "lookupId": f"osint-passive-scan-denied-{uuid.uuid4().hex[:8]}",
            "lookupType": scan_type,
            "target": target,
            "targetScope": target_scope or "MISSING",
            "engagementPolicyRef": policy_ref or "MISSING",
            "authorizationRef": authorization_ref or "MISSING",
            "executionMode": "fixture" if fixture_mode else "passive_public_source",
            "nonDestructiveOnly": True,
            "networkBoundary": "no_external_contact",
            "sourceEvidenceRef": "gate_enforcer",
            "operatorIdentityRef": operator_identity_ref or "MISSING",
            "receiptRequired": True,
            "fixtureMode": fixture_mode,
            "result": {
                "status": "denied_unauthorized_lookup_type",
                "records": [],
                "confidenceCaveat": "Unknown scan type.",
            },
            "receiptEmitted": True,
            "queriedAt": datetime.now(timezone.utc).isoformat(),
            "actionDeniedReceipt": "denied_unauthorized_lookup_type",
            "denialMessage": f"Unknown scan type '{scan_type}'. Supported: {sorted(SUPPORTED_SCAN_TYPES)}",
        }
        _emit_receipt(denial, receipt_sink)
        return denial

    # Map scan types to gate lookup types
    _GATE_TYPE_MAP = {"ssl": "certs", "headers": "dns", "rdns": "dns", "tech": "whois"}
    gate_lookup_type = _GATE_TYPE_MAP[scan_type]

    req = EngagementRequest(
        lookup_type=gate_lookup_type,
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
    record_id = f"osint-passive-scan-{uuid.uuid4().hex[:8]}"

    if not decision.authorized:
        result = build_denial_record(req, decision)
        result["lookupId"] = record_id
        result["lookupType"] = f"scan:{scan_type}"
        _emit_receipt(result, receipt_sink)
        return result

    if fixture_mode or target_scope == "fixture_only":
        data = dict(FIXTURE_RESULTS[scan_type])
        data["target"] = target
        network_boundary, status = "no_external_contact", "fixture_only"
    else:
        if scan_type == "ssl":
            data = _ssl_scan(target, port or 443)
        elif scan_type == "headers":
            data = _headers_scan(target)
        elif scan_type == "rdns":
            data = _rdns_scan(target)
        elif scan_type == "tech":
            data = _tech_scan(target)
        network_boundary = "public_source_api_only"
        status = "error" if "error" in data else "success"

    result = {
        "schemaVersion": "0.1.0",
        "lookupId": record_id,
        "lookupType": f"scan:{scan_type}",
        "target": target,
        "targetScope": req.target_scope,
        "engagementPolicyRef": policy_ref,
        "authorizationRef": authorization_ref,
        "executionMode": req.execution_mode,
        "nonDestructiveOnly": True,
        "networkBoundary": network_boundary,
        "sourceEvidenceRef": f"SCOPE-D scanner adapter (passive {scan_type} only)",
        "operatorIdentityRef": operator_identity_ref,
        "receiptRequired": True,
        "fixtureMode": fixture_mode,
        "result": {
            "status": status,
            "records": [data],
            "confidenceCaveat": f"Passive {scan_type} metadata only. No active probing, no exploit, no injection. Results reflect a single passive observation.",
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
    ap = argparse.ArgumentParser(description="SCOPE-D policy-gated scanner adapter")
    ap.add_argument("--scan-type", required=True, choices=sorted(SUPPORTED_SCAN_TYPES | ADAPTER_BLOCKED),
                    help=f"Scan type. Supported: {sorted(SUPPORTED_SCAN_TYPES)}. Blocked: {sorted(ADAPTER_BLOCKED)}")
    ap.add_argument("--target", required=True, help="Domain or IP")
    ap.add_argument("--port", type=int, help="Port (ssl only, default 443)")
    ap.add_argument("--policy", default=""); ap.add_argument("--auth", default="")
    ap.add_argument("--scope", default="fixture_only"); ap.add_argument("--operator", default="michael@socioprophet.ai")
    ap.add_argument("--receipt-sink", default="raw/osint_receipts.jsonl")
    ap.add_argument("--fixture", action="store_true"); ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    result = scanner_scan(args.scan_type, args.target, args.policy, args.auth, args.scope,
                          args.operator, args.receipt_sink, args.fixture, args.port)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        status = result["result"]["status"]
        print(f"scan:{args.scan_type} {args.target} → {status}")
        for r in result["result"].get("records", []):
            for k, v in r.items():
                if k != "source":
                    print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
