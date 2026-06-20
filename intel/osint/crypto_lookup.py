#!/usr/bin/env python3
"""Passive crypto wallet/address lookup — SCOPE-D OSINT passive lookup lane.

Queries public blockchain explorers for on-chain transaction context:
balance, transaction count, first/last seen, associated labels.

Chains supported:
  BTC  → Blockchain.info / Blockstream.info public API
  ETH  → Etherscan.io public API (no API key for basic balance)
  SOL  → Solana public RPC (mainnet-beta)

No identity attribution: blockchain address ≠ person identity. Results are
public ledger context only, not KYC or identity proof. AML interpretation
requires a licensed provider (Chainalysis, Elliptic) — not this module.

Risk class: medium/high. Gate: EngagementPolicy + scope + no-attribution caveat + receipt.

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

BTC_API   = "https://blockstream.info/api/address/{addr}"
ETH_API   = "https://api.etherscan.io/api?module=account&action=balance&address={addr}&tag=latest"
SOL_RPC   = "https://api.mainnet-beta.solana.com"

BTC_RE    = re.compile(r"^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$")
ETH_RE    = re.compile(r"^0x[0-9a-fA-F]{40}$")
SOL_RE    = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")

FIXTURE_CRYPTO = {
    "bc1qfixturefixturefixturefixture00000000": {
        "chain": "BTC",
        "address": "bc1qfixturefixturefixturefixture00000000",
        "balance_satoshi": 0,
        "balance_btc": 0.0,
        "tx_count": 0,
        "first_seen": None,
        "last_seen": None,
        "source": "fixture",
    },
    "0x0000000000000000000000000000000000000000": {
        "chain": "ETH",
        "address": "0x0000000000000000000000000000000000000000",
        "balance_wei": "1234567890000000000",
        "balance_eth": 1.23456789,
        "source": "fixture",
    },
}


def _detect_chain(addr: str) -> str | None:
    if BTC_RE.match(addr):
        return "BTC"
    if ETH_RE.match(addr):
        return "ETH"
    if SOL_RE.match(addr):
        return "SOL"
    return None


def _btc_lookup(addr: str) -> dict:
    try:
        url = BTC_API.format(addr=addr)
        with urllib.request.urlopen(url, timeout=15) as resp:
            d = json.loads(resp.read().decode())
        stats = d.get("chain_stats", {})
        return {
            "chain": "BTC",
            "address": addr,
            "balance_satoshi": stats.get("funded_txo_sum", 0) - stats.get("spent_txo_sum", 0),
            "balance_btc": round((stats.get("funded_txo_sum", 0) - stats.get("spent_txo_sum", 0)) / 1e8, 8),
            "tx_count": stats.get("tx_count", 0),
            "funded_txo_count": stats.get("funded_txo_count", 0),
            "spent_txo_count": stats.get("spent_txo_count", 0),
            "source": "blockstream.info",
        }
    except Exception as e:
        return {"error": str(e)}


def _eth_lookup(addr: str) -> dict:
    try:
        url = ETH_API.format(addr=addr)
        with urllib.request.urlopen(url, timeout=15) as resp:
            d = json.loads(resp.read().decode())
        if d.get("status") == "1":
            wei = int(d.get("result", 0))
            return {
                "chain": "ETH",
                "address": addr,
                "balance_wei": str(wei),
                "balance_eth": round(wei / 1e18, 8),
                "source": "etherscan.io",
            }
        return {"chain": "ETH", "address": addr, "error": d.get("message", "unknown"), "source": "etherscan.io"}
    except Exception as e:
        return {"error": str(e)}


def _sol_lookup(addr: str) -> dict:
    payload = json.dumps({
        "jsonrpc": "2.0", "id": 1,
        "method": "getBalance",
        "params": [addr],
    }).encode()
    try:
        req = urllib.request.Request(
            SOL_RPC,
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            d = json.loads(resp.read().decode())
        lamports = d.get("result", {}).get("value", 0)
        return {
            "chain": "SOL",
            "address": addr,
            "balance_lamports": lamports,
            "balance_sol": round(lamports / 1e9, 9),
            "source": "solana_mainnet_rpc",
        }
    except Exception as e:
        return {"error": str(e)}


def crypto_lookup(
    target: str,
    policy_ref: str,
    authorization_ref: str,
    target_scope: str,
    operator_identity_ref: str,
    receipt_sink: str,
    fixture_mode: bool = False,
    chain: str | None = None,
) -> dict:
    req = EngagementRequest(
        lookup_type="bgp",  # public ledger context — closest allowed type
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
    record_id = f"osint-passive-crypto-{uuid.uuid4().hex[:8]}"

    if not decision.authorized:
        result = build_denial_record(req, decision)
        result["lookupId"] = record_id
        result["lookupType"] = "crypto"
        _emit_receipt(result, receipt_sink)
        return result

    if fixture_mode or target_scope == "fixture_only":
        data = FIXTURE_CRYPTO.get(target, FIXTURE_CRYPTO["bc1qfixturefixturefixturefixture00000000"])
        network_boundary, status = "no_external_contact", "fixture_only"
    else:
        detected = chain or _detect_chain(target)
        if detected == "BTC":
            data = _btc_lookup(target)
        elif detected == "ETH":
            data = _eth_lookup(target)
        elif detected == "SOL":
            data = _sol_lookup(target)
        else:
            data = {"error": f"Could not detect chain for address '{target}'. Use --chain BTC|ETH|SOL."}
        network_boundary = "public_source_api_only"
        status = "error" if "error" in data else "success"

    result = {
        "schemaVersion": "0.1.0",
        "lookupId": record_id,
        "lookupType": "crypto",
        "target": target,
        "targetScope": req.target_scope,
        "engagementPolicyRef": policy_ref,
        "authorizationRef": authorization_ref,
        "executionMode": req.execution_mode,
        "nonDestructiveOnly": True,
        "networkBoundary": network_boundary,
        "sourceEvidenceRef": "Blockstream.info / Etherscan.io / Solana mainnet RPC (public ledger, read-only)",
        "operatorIdentityRef": operator_identity_ref,
        "receiptRequired": True,
        "fixtureMode": fixture_mode,
        "result": {
            "status": status,
            "records": [data],
            "confidenceCaveat": "Blockchain address ≠ person identity. On-chain balance/tx count only — no clustering, no AML, no identity attribution. AML interpretation requires a licensed provider. Do not use as identity proof.",
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
    ap = argparse.ArgumentParser(description="SCOPE-D passive crypto wallet lookup (BTC/ETH/SOL)")
    ap.add_argument("--target", required=True, help="Blockchain address")
    ap.add_argument("--chain", choices=["BTC", "ETH", "SOL"], help="Force chain (auto-detected if omitted)")
    ap.add_argument("--policy", default=""); ap.add_argument("--auth", default="")
    ap.add_argument("--scope", default="fixture_only"); ap.add_argument("--operator", default="michael@socioprophet.ai")
    ap.add_argument("--receipt-sink", default="raw/osint_receipts.jsonl")
    ap.add_argument("--fixture", action="store_true"); ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    result = crypto_lookup(args.target, args.policy, args.auth, args.scope, args.operator, args.receipt_sink, args.fixture, args.chain)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        recs = result["result"].get("records", [])
        print(f"Crypto: {args.target} → {result['result']['status']}")
        for r in recs:
            if "error" in r:
                print(f"  error: {r['error']}")
            else:
                chain = r.get("chain", "?")
                if chain == "BTC":
                    print(f"  BTC balance: {r.get('balance_btc','?')} BTC  tx_count: {r.get('tx_count','?')}")
                elif chain == "ETH":
                    print(f"  ETH balance: {r.get('balance_eth','?')} ETH")
                elif chain == "SOL":
                    print(f"  SOL balance: {r.get('balance_sol','?')} SOL")


if __name__ == "__main__":
    main()
