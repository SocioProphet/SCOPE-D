#!/usr/bin/env python3
"""Smoke-tests for the EngagementPolicy gate validator.

Runs against the fixtures in fixtures/osint/ to verify gate decisions match
expected denial reasons. No network contact in any path.

Usage:
  python intel/osint/test_gate_validator.py
  python -m pytest intel/osint/test_gate_validator.py -v
"""
import sys
from pathlib import Path

# Allow running from repo root or intel/osint/
sys.path.insert(0, str(Path(__file__).parent))

from validate_engagement_policy import (
    ALLOWED_LOOKUP_TYPES,
    BLOCKED_LOOKUP_TYPES,
    DenialReason,
    EngagementRequest,
    GateDecision,
    check_engagement_policy,
)

PASS = "✓"
FAIL = "✗"

_results = []


def _test(name: str, req: EngagementRequest, expected_authorized: bool, expected_reason=None):
    decision = check_engagement_policy(req)
    ok = decision.authorized == expected_authorized
    if expected_reason is not None:
        ok = ok and decision.denial_reason == expected_reason
    _results.append((name, ok, decision))
    status = PASS if ok else FAIL
    detail = ""
    if not ok:
        detail = f"  got authorized={decision.authorized}, reason={decision.denial_reason}, msg={decision.denial_message}"
    print(f"  {status} {name}{detail}")
    return ok


def _base() -> dict:
    return dict(
        lookup_type="dns",
        target="fixture.example",
        target_scope="fixture_only",
        engagement_policy_ref="policy-ref",
        authorization_ref="auth-ref",
        execution_mode="fixture",
        operator_identity_ref="michael@socioprophet.ai",
        receipt_sink="/tmp/receipts.jsonl",
        fixture_mode=True,
        non_destructive_only=True,
    )


def test_gate_1_no_policy():
    kw = _base(); kw["engagement_policy_ref"] = ""
    _test("Gate 1: no_policy", EngagementRequest(**kw), False, DenialReason.NO_ENGAGEMENT_POLICY)


def test_gate_2_no_scope():
    kw = _base(); kw["target_scope"] = ""
    _test("Gate 2: no_scope", EngagementRequest(**kw), False, DenialReason.NO_TARGET_SCOPE)


def test_gate_3_no_auth():
    kw = _base(); kw["authorization_ref"] = ""
    _test("Gate 3: no_auth", EngagementRequest(**kw), False, DenialReason.NO_AUTHORIZATION_REF)


def test_gate_4_no_operator():
    kw = _base(); kw["operator_identity_ref"] = ""
    _test("Gate 4: no_operator", EngagementRequest(**kw), False, DenialReason.NO_OPERATOR_IDENTITY)


def test_gate_5_no_receipt():
    kw = _base(); kw["receipt_sink"] = ""
    _test("Gate 5: no_receipt_sink", EngagementRequest(**kw), False, DenialReason.NO_RECEIPT_SINK)


def test_gate_6_blocked_type():
    for bt in BLOCKED_LOOKUP_TYPES:
        kw = _base(); kw["lookup_type"] = bt
        _test(f"Gate 6: blocked_type={bt}", EngagementRequest(**kw), False, DenialReason.UNAUTHORIZED_LOOKUP_TYPE)


def test_gate_7_unknown_type():
    kw = _base(); kw["lookup_type"] = "magic_scan"; kw["fixture_mode"] = False
    _test("Gate 7: unknown_lookup_type", EngagementRequest(**kw), False, DenialReason.UNAUTHORIZED_LOOKUP_TYPE)


def test_gate_8_stealth():
    kw = _base(); kw["stealth_mode"] = True
    _test("Gate 8: stealth_semantics", EngagementRequest(**kw), False, DenialReason.STEALTH_SEMANTICS)


def test_gate_8_evasion_flag():
    kw = _base(); kw["additional_flags"] = {"evasion": True}
    _test("Gate 8: evasion_flag", EngagementRequest(**kw), False, DenialReason.STEALTH_SEMANTICS)


def test_gate_9_destructive():
    kw = _base(); kw["non_destructive_only"] = False
    _test("Gate 9: destructive_mode", EngagementRequest(**kw), False, DenialReason.DESTRUCTIVE_MODE)


def test_gate_10_bad_exec_mode():
    kw = _base(); kw["execution_mode"] = "active_scan"; kw["fixture_mode"] = False
    _test("Gate 10: bad_execution_mode", EngagementRequest(**kw), False, DenialReason.DESTRUCTIVE_MODE)


def test_gate_11_private_ip_no_scope():
    kw = _base()
    kw["target"] = "10.0.0.1"
    kw["target_scope"] = "public_research_no_pii"
    kw["fixture_mode"] = False
    kw["execution_mode"] = "passive_public_source"
    _test("Gate 11: private_ip public_research scope", EngagementRequest(**kw), False, DenialReason.PRIVATE_TARGET)


def test_gate_11_private_ip_owned_scope():
    kw = _base()
    kw["target"] = "10.0.0.1"
    kw["target_scope"] = "owned_infrastructure"
    kw["fixture_mode"] = True
    kw["execution_mode"] = "fixture"
    _test("Gate 11: private_ip owned scope (PASS)", EngagementRequest(**kw), True)


def test_gate_12_fixture_scope_warning():
    kw = _base()
    kw["target_scope"] = "fixture_only"
    kw["execution_mode"] = "passive_public_source"
    kw["fixture_mode"] = False
    req = EngagementRequest(**kw)
    decision = check_engagement_policy(req)
    ok = decision.authorized and len(decision.warnings) > 0
    _results.append(("Gate 12: fixture_only scope warning", ok, decision))
    print(f"  {'✓' if ok else '✗'} Gate 12: fixture_only scope warning (warnings={decision.warnings})")


def test_happy_path():
    kw = _base()
    _test("Happy path: fixture DNS", EngagementRequest(**kw), True)


def test_all_allowed_types():
    for lt in ALLOWED_LOOKUP_TYPES:
        kw = _base(); kw["lookup_type"] = lt
        _test(f"Allowed type: {lt}", EngagementRequest(**kw), True)


def main():
    print("SCOPE-D EngagementPolicy gate validator tests")
    print("=" * 50)
    test_gate_1_no_policy()
    test_gate_2_no_scope()
    test_gate_3_no_auth()
    test_gate_4_no_operator()
    test_gate_5_no_receipt()
    test_gate_6_blocked_type()
    test_gate_7_unknown_type()
    test_gate_8_stealth()
    test_gate_8_evasion_flag()
    test_gate_9_destructive()
    test_gate_10_bad_exec_mode()
    test_gate_11_private_ip_no_scope()
    test_gate_11_private_ip_owned_scope()
    test_gate_12_fixture_scope_warning()
    test_happy_path()
    test_all_allowed_types()

    passed = sum(1 for _, ok, _ in _results if ok)
    total = len(_results)
    print("=" * 50)
    print(f"Results: {passed}/{total} passed")
    if passed < total:
        sys.exit(1)


if __name__ == "__main__":
    main()
