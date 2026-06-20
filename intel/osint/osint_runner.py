#!/usr/bin/env python3
"""SCOPE-D OSINT Runner — unified target profiler.

Orchestrates all passive lookup modules against a single target and produces
a consolidated profile. Auto-detects target type (domain, IP, email, GitHub
handle, CVE ID, phone, crypto address) and runs appropriate lookup lanes.

All lookups route through the EngagementPolicy gate. A single policy_ref +
authorization_ref + target_scope covers all sub-lookups in the run.

Output: JSON profile written to raw/<profileId>.json + receipt lines in sink.

Usage:
  python intel/osint/osint_runner.py --target socioprophet.ai \
    --policy engagement-policy-owned-infra \
    --auth "owner: michael@socioprophet.ai" \
    --scope owned_infrastructure \
    --operator michael@socioprophet.ai \
    --receipt-sink raw/osint_receipts.jsonl

  python intel/osint/osint_runner.py --target 8.8.8.8 \
    --policy engagement-policy-research \
    --auth "public_research: infra context" \
    --scope public_research_no_pii

  python intel/osint/osint_runner.py --target fixture.example --fixture
"""
import argparse
import ipaddress
import json
import re
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))

from dns_lookup            import dns_lookup
from whois_lookup          import whois_lookup
from certs_lookup          import certs_lookup
from bgp_lookup            import bgp_lookup
from mac_vendor_lookup     import mac_vendor_lookup
from cve_lookup            import cve_lookup
from internetdb_lookup     import internetdb_lookup
from geolocation_lookup    import geolocation_lookup
from github_context_lookup import github_context_lookup
from sanctions_lookup      import sanctions_lookup
from crypto_lookup         import crypto_lookup
from phone_lookup          import phone_lookup
from breach_lookup         import breach_lookup

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
CVE_RE   = re.compile(r"^CVE-\d{4}-\d{4,}$", re.I)
BTC_RE   = re.compile(r"^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$")
ETH_RE   = re.compile(r"^0x[0-9a-fA-F]{40}$")
SOL_RE   = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
MAC_RE   = re.compile(r"^([0-9a-fA-F]{2}[:\-]){5}[0-9a-fA-F]{2}$|^[0-9a-fA-F]{12}$")
PHONE_RE = re.compile(r"^\+[1-9]\d{6,14}$")

# Lanes run per detected target type
LANE_MAP: dict[str, list[str]] = {
    "domain":        ["dns", "whois", "certs", "breach_domain"],
    "ip":            ["bgp", "geolocation", "internetdb", "rdns"],
    "email":         ["breach_email", "sanctions"],
    "github_handle": ["github"],
    "cve":           ["cve"],
    "mac":           ["mac_vendor"],
    "phone":         ["phone"],
    "crypto_btc":    ["crypto"],
    "crypto_eth":    ["crypto"],
    "crypto_sol":    ["crypto"],
    "cidr":          [],  # use cidr_sweep.py directly
    "unknown":       [],
}


def detect_target_type(target: str) -> list[str]:
    t = target.strip()
    if CVE_RE.match(t):
        return ["cve"]
    if ETH_RE.match(t):
        return ["crypto_eth"]
    if BTC_RE.match(t):
        return ["crypto_btc"]
    if len(t) >= 32 and SOL_RE.match(t):
        return ["crypto_sol"]
    if EMAIL_RE.match(t):
        return ["email"]
    if MAC_RE.match(t.replace(":", "").replace("-", "")):
        return ["mac"]
    if PHONE_RE.match(t.replace(" ", "").replace("-", "")):
        return ["phone"]
    try:
        ipaddress.ip_address(t)
        return ["ip"]
    except ValueError:
        pass
    try:
        ipaddress.ip_network(t, strict=False)
        if "/" in t:
            return ["cidr"]
    except ValueError:
        pass
    if "." in t and not t.startswith("http"):
        return ["domain"]
    return ["github_handle"]


def _run_lane(lane: str, target: str, kw: dict) -> tuple[str, dict]:
    try:
        if lane == "dns":
            return lane, dns_lookup(target, **kw)
        if lane == "whois":
            return lane, whois_lookup(target, **kw)
        if lane == "certs":
            return lane, certs_lookup(target, **kw)
        if lane == "bgp":
            return lane, bgp_lookup(target, **kw)
        if lane == "rdns":
            return lane, dns_lookup(target, **kw)
        if lane == "geolocation":
            return lane, geolocation_lookup(target, **kw)
        if lane == "internetdb":
            return lane, internetdb_lookup(target, **kw)
        if lane == "mac_vendor":
            return lane, mac_vendor_lookup(target, **kw)
        if lane == "cve":
            return lane, cve_lookup(target, **kw)
        if lane == "github":
            return lane, github_context_lookup(target, **kw)
        if lane == "sanctions":
            return lane, sanctions_lookup(target, **kw)
        if lane == "crypto":
            return lane, crypto_lookup(target, **kw)
        if lane == "phone":
            return lane, phone_lookup(target, **kw)
        if lane == "breach_email":
            return lane, breach_lookup(target, include_pastes=True, **kw)
        if lane == "breach_domain":
            return lane, breach_lookup(target, include_pastes=False, **kw)
        return lane, {"error": f"unknown lane: {lane}", "result": {"status": "error"}}
    except Exception as e:
        return lane, {"error": str(e), "result": {"status": "error", "records": []}}


def run_profile(
    target: str,
    policy_ref: str,
    authorization_ref: str,
    target_scope: str,
    operator_identity_ref: str,
    receipt_sink: str,
    fixture_mode: bool = False,
    lanes_override: list[str] | None = None,
    concurrency: int = 8,
    out_dir: str = "raw",
) -> dict:
    profile_id = f"osint-profile-{uuid.uuid4().hex[:12]}"
    started_at = datetime.now(timezone.utc).isoformat()

    target_types = detect_target_type(target)
    lanes = lanes_override or list(dict.fromkeys(
        l for tt in target_types for l in LANE_MAP.get(tt, [])
    ))

    kw = dict(
        policy_ref=policy_ref,
        authorization_ref=authorization_ref,
        target_scope=target_scope,
        operator_identity_ref=operator_identity_ref,
        receipt_sink=receipt_sink,
        fixture_mode=fixture_mode,
    )

    results: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futs = {pool.submit(_run_lane, lane, target, kw): lane for lane in lanes}
        for fut in as_completed(futs):
            lane, result = fut.result()
            results[lane] = result

    statuses = {lane: r.get("result", {}).get("status", "unknown") for lane, r in results.items()}
    denied  = [l for l, s in statuses.items() if "denied" in str(s)]
    errors  = [l for l, s in statuses.items() if s == "error"]
    success = [l for l, s in statuses.items() if s not in ("error",) and "denied" not in str(s)]

    profile = {
        "profileId": profile_id,
        "target": target,
        "targetTypes": target_types,
        "lanesRun": lanes,
        "engagementPolicyRef": policy_ref,
        "authorizationRef": authorization_ref,
        "targetScope": target_scope,
        "operatorIdentityRef": operator_identity_ref,
        "fixtureMode": fixture_mode,
        "startedAt": started_at,
        "completedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total": len(lanes),
            "success": len(success),
            "denied": len(denied),
            "errors": len(errors),
            "laneStatuses": statuses,
        },
        "results": results,
    }

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    profile_path = out / f"{profile_id}.json"
    profile_path.write_text(json.dumps(profile, indent=2))
    profile["profilePath"] = str(profile_path)
    return profile


def main():
    ap = argparse.ArgumentParser(description="SCOPE-D OSINT Runner — unified target profiler")
    ap.add_argument("--target", required=True)
    ap.add_argument("--lanes", help="Comma-separated lane override")
    ap.add_argument("--concurrency", type=int, default=8)
    ap.add_argument("--out-dir", default="raw")
    ap.add_argument("--policy", default="")
    ap.add_argument("--auth", default="")
    ap.add_argument("--scope", default="fixture_only")
    ap.add_argument("--operator", default="michael@socioprophet.ai")
    ap.add_argument("--receipt-sink", default="raw/osint_receipts.jsonl")
    ap.add_argument("--fixture", action="store_true")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    lanes = [l.strip() for l in args.lanes.split(",")] if args.lanes else None
    profile = run_profile(
        target=args.target,
        policy_ref=args.policy,
        authorization_ref=args.auth,
        target_scope=args.scope,
        operator_identity_ref=args.operator,
        receipt_sink=args.receipt_sink,
        fixture_mode=args.fixture,
        lanes_override=lanes,
        concurrency=args.concurrency,
        out_dir=args.out_dir,
    )

    if args.json:
        print(json.dumps(profile, indent=2))
    else:
        s = profile["summary"]
        print(f"Profile: {args.target}  [{', '.join(profile['targetTypes'])}]")
        print(f"  lanes={s['total']}  ok={s['success']}  denied={s['denied']}  err={s['errors']}")
        for lane, status in s["laneStatuses"].items():
            mark = "✓" if "denied" not in str(status) and status != "error" else "✗"
            print(f"  {mark} {lane:25} {status}")
        print(f"  saved: {profile.get('profilePath')}")


if __name__ == "__main__":
    main()
