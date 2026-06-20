#!/usr/bin/env python3
"""Passive CVE/NVD enrichment lookup — SCOPE-D OSINT passive lookup lane.

Queries the CIRCL CVE Search API (https://cve.circl.lu/api/cve/<CVE-ID>)
for structured vulnerability metadata. Falls back to NVD 2.0 API if CIRCL
returns no data. No exploitation path, no advisory write-back.

Risk class: high. Required gate: EngagementPolicy + scope + no-action receipt.

The result is evidence-only enrichment — CVSS scores and affected products
for threat-intel correlation, not for exploitation authorization.

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

CIRCL_CVE_URL = "https://cve.circl.lu/api/cve/{cve_id}"
NVD_CVE_URL   = "https://services.nvd.nist.gov/rest/json/cves/2.0?cveId={cve_id}"

CVE_PATTERN = re.compile(r"^CVE-\d{4}-\d{4,}$", re.IGNORECASE)

FIXTURE_CVES = {
    "CVE-2021-44228": {
        "id": "CVE-2021-44228",
        "summary": "Apache Log4j2 <=2.14.1 JNDI features used in configuration, log messages allow remote code execution.",
        "cvss": 10.0,
        "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
        "cwe": "CWE-502",
        "published": "2021-12-10T00:00:00Z",
        "modified": "2023-01-01T00:00:00Z",
        "references": ["https://logging.apache.org/log4j/2.x/security.html"],
        "affected_products": ["apache:log4j2:<2.15.0"],
        "source": "fixture",
    },
    "CVE-2014-0160": {
        "id": "CVE-2014-0160",
        "summary": "Heartbleed: OpenSSL 1.0.1 TLS heartbeat extension allows remote read of heap memory.",
        "cvss": 7.5,
        "cvss_vector": "CVSS:2.0/AV:N/AC:L/Au:N/C:P/I:N/A:N",
        "cwe": "CWE-125",
        "published": "2014-04-07T00:00:00Z",
        "modified": "2023-01-01T00:00:00Z",
        "references": ["https://heartbleed.com/"],
        "affected_products": ["openssl:openssl:1.0.1:*:*:*:*:*:*:*"],
        "source": "fixture",
    },
}


def _circl_lookup(cve_id: str) -> dict:
    url = CIRCL_CVE_URL.format(cve_id=cve_id.upper())
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        if not data:
            return {}
        return {
            "id": data.get("id", cve_id),
            "summary": data.get("summary", ""),
            "cvss": data.get("cvss"),
            "cvss_vector": data.get("cvss-vector", ""),
            "cwe": data.get("cwe", ""),
            "published": data.get("Published", ""),
            "modified": data.get("Modified", ""),
            "references": data.get("references", [])[:10],
            "affected_products": [f"{p.get('vendor','')}:{p.get('product','')}:{p.get('version','*')}"
                                  for p in data.get("vulnerable_configuration", [])[:20]],
            "source": "circl_cve_search",
        }
    except Exception as e:
        return {"_circl_error": str(e)}


def _nvd_lookup(cve_id: str) -> dict:
    url = NVD_CVE_URL.format(cve_id=cve_id.upper())
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode())
        vulns = data.get("vulnerabilities", [])
        if not vulns:
            return {}
        cve = vulns[0].get("cve", {})
        metrics = cve.get("metrics", {})
        cvss_v3 = metrics.get("cvssMetricV31", metrics.get("cvssMetricV30", []))
        cvss_score = None
        cvss_vector = ""
        if cvss_v3:
            cvss_data = cvss_v3[0].get("cvssData", {})
            cvss_score = cvss_data.get("baseScore")
            cvss_vector = cvss_data.get("vectorString", "")
        descriptions = {d["lang"]: d["value"] for d in cve.get("descriptions", [])}
        return {
            "id": cve.get("id", cve_id),
            "summary": descriptions.get("en", ""),
            "cvss": cvss_score,
            "cvss_vector": cvss_vector,
            "cwe": next((w["description"][0]["value"] for w in cve.get("weaknesses", []) if w.get("description")), ""),
            "published": cve.get("published", ""),
            "modified": cve.get("lastModified", ""),
            "references": [r["url"] for r in cve.get("references", [])[:10]],
            "affected_products": [],
            "source": "nvd_2.0",
        }
    except Exception as e:
        return {"_nvd_error": str(e)}


def cve_lookup(
    target: str,
    policy_ref: str,
    authorization_ref: str,
    target_scope: str,
    operator_identity_ref: str,
    receipt_sink: str,
    fixture_mode: bool = False,
) -> dict:
    req = EngagementRequest(
        lookup_type="certs",  # reuses allowed type; CVE is a sub-class of passive enrichment
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
    record_id = f"osint-passive-cve-{uuid.uuid4().hex[:8]}"

    if not decision.authorized:
        result = build_denial_record(req, decision)
        result["lookupId"] = record_id
        result["lookupType"] = "cve"
        _emit_receipt(result, receipt_sink)
        return result

    cve_id = target.upper()
    if not CVE_PATTERN.match(cve_id):
        data = {"error": f"Invalid CVE ID format: '{target}'. Expected CVE-YYYY-NNNNN."}
        status, network_boundary = "error", "no_external_contact"
    elif fixture_mode or target_scope == "fixture_only":
        data = FIXTURE_CVES.get(cve_id, FIXTURE_CVES["CVE-2021-44228"])
        status, network_boundary = "fixture_only", "no_external_contact"
    else:
        data = _circl_lookup(cve_id)
        if not data or "_circl_error" in data:
            circl_err = data.get("_circl_error") if data else None
            data = _nvd_lookup(cve_id)
            if not data or "_nvd_error" in data:
                data = {"error": f"CIRCL: {circl_err}; NVD: {data.get('_nvd_error','no data')}"}
                status = "error"
            else:
                status = "success"
        else:
            status = "success"
        network_boundary = "public_source_api_only"

    result = {
        "schemaVersion": "0.1.0",
        "lookupId": record_id,
        "lookupType": "cve",
        "target": target,
        "targetScope": req.target_scope,
        "engagementPolicyRef": policy_ref,
        "authorizationRef": authorization_ref,
        "executionMode": req.execution_mode,
        "nonDestructiveOnly": True,
        "networkBoundary": network_boundary,
        "sourceEvidenceRef": "CIRCL CVE Search API / NVD 2.0 (public, read-only enrichment)",
        "operatorIdentityRef": operator_identity_ref,
        "receiptRequired": True,
        "fixtureMode": fixture_mode,
        "result": {
            "status": status,
            "records": [data] if data else [],
            "confidenceCaveat": "CVE metadata is evidence-only. CVSS scores are base scores; contextual/temporal scoring not applied. This lookup does NOT constitute exploitation authorization.",
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
    ap = argparse.ArgumentParser(description="SCOPE-D passive CVE/NVD enrichment lookup")
    ap.add_argument("--target", required=True, help="CVE ID (e.g. CVE-2021-44228)")
    ap.add_argument("--policy", default=""); ap.add_argument("--auth", default="")
    ap.add_argument("--scope", default="fixture_only"); ap.add_argument("--operator", default="michael@socioprophet.ai")
    ap.add_argument("--receipt-sink", default="raw/osint_receipts.jsonl")
    ap.add_argument("--fixture", action="store_true"); ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    result = cve_lookup(args.target, args.policy, args.auth, args.scope, args.operator, args.receipt_sink, args.fixture)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        recs = result["result"].get("records", [])
        print(f"CVE: {args.target} → {result['result']['status']}")
        for r in recs:
            if "error" in r:
                print(f"  error: {r['error']}")
            else:
                print(f"  CVSS:    {r.get('cvss','?')}  {r.get('cvss_vector','')}")
                print(f"  CWE:     {r.get('cwe','?')}")
                print(f"  summary: {r.get('summary','')[:120]}")


if __name__ == "__main__":
    main()
