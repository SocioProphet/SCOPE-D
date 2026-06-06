#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "config" / "schemas" / "legal-core.schema.json"
ALLOWED_FIXTURE = ROOT / "tests" / "fixtures" / "legal-core" / "defensive-endpoint-triage.allowed.json"
BLOCKED_FIXTURE = ROOT / "tests" / "fixtures" / "legal-core" / "unknown-authority.blocked.json"

BLOCKING_AUTHORITY = {"unknown", "prohibited"}
BLOCKED_EFFECTS = {
    "collectionAllowed",
    "runtimeActionAllowed",
    "semanticPromotionAllowed",
    "graphBindingAllowed",
    "reportEmissionAllowed",
}


class ValidationError(Exception):
    pass


def fail(message: str) -> None:
    raise ValidationError(message)


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValidationError(f"missing file: {path.relative_to(ROOT)}") from exc
    except json.JSONDecodeError as exc:
        raise ValidationError(f"invalid JSON in {path.relative_to(ROOT)}: {exc}") from exc


def require_keys(record: dict[str, Any], keys: list[str], path: Path) -> None:
    missing = [key for key in keys if key not in record]
    if missing:
        fail(f"{path}: missing required keys {missing}")


def validate_common(record: dict[str, Any], path: Path) -> None:
    require_keys(
        record,
        [
            "schemaVersion",
            "decisionId",
            "decisionType",
            "authorityBasis",
            "purpose",
            "rightsProfile",
            "sensitivityProfile",
            "jurisdictionOverlay",
            "safeProcessing",
            "claimBoundary",
            "decision",
            "effects",
            "receiptRefs",
            "createdAt",
            "nonClaims",
        ],
        path,
    )
    if record["schemaVersion"] != "0.1.0":
        fail(f"{path}: schemaVersion must be 0.1.0")
    if not str(record["decisionId"]).startswith("legal-core-decision:"):
        fail(f"{path}: decisionId must start with legal-core-decision:")
    if not isinstance(record.get("nonClaims"), list) or not record["nonClaims"]:
        fail(f"{path}: nonClaims must be a non-empty array")
    if record.get("safeProcessing", {}).get("unsafeRenderingAllowed") is not False:
        fail(f"{path}: unsafeRenderingAllowed must remain false")
    if record.get("safeProcessing", {}).get("credentialAccessAllowed") is not False:
        fail(f"{path}: credentialAccessAllowed must remain false")
    if not isinstance(record.get("receiptRefs"), list):
        fail(f"{path}: receiptRefs must be an array")
    allowed_claim_states = record.get("claimBoundary", {}).get("allowedClaimStates", [])
    if not isinstance(allowed_claim_states, list) or not allowed_claim_states:
        fail(f"{path}: claimBoundary.allowedClaimStates must be non-empty")


def validate_allowed_endpoint_triage(record: dict[str, Any], path: Path) -> None:
    validate_common(record, path)
    if record.get("authorityBasis") != "first_party_defensive":
        fail(f"{path}: allowed endpoint triage requires first_party_defensive authority")
    if record.get("decision") != "allowed":
        fail(f"{path}: allowed fixture must have decision=allowed")
    effects = record.get("effects", {})
    expected_true = {"collectionAllowed", "graphBindingAllowed", "reportEmissionAllowed"}
    expected_false = {"runtimeActionAllowed", "semanticPromotionAllowed", "humanReviewRequired"}
    for key in expected_true:
        if effects.get(key) is not True:
            fail(f"{path}: {key} must be true")
    for key in expected_false:
        if effects.get(key) is not False:
            fail(f"{path}: {key} must be false")
    if record.get("safeProcessing", {}).get("externalLookupAllowed") is not False:
        fail(f"{path}: externalLookupAllowed must be false for suspect endpoint triage")
    if record.get("safeProcessing", {}).get("mutationAllowed") is not False:
        fail(f"{path}: mutationAllowed must be false for suspect endpoint triage")
    if record.get("safeProcessing", {}).get("networkAccessAllowed") is not False:
        fail(f"{path}: networkAccessAllowed must be false for suspect endpoint triage")


def validate_blocked_unknown_authority(record: dict[str, Any], path: Path) -> None:
    validate_common(record, path)
    if record.get("authorityBasis") not in BLOCKING_AUTHORITY:
        fail(f"{path}: blocked fixture must use unknown or prohibited authority")
    if record.get("decision") != "blocked":
        fail(f"{path}: blocked fixture must have decision=blocked")
    effects = record.get("effects", {})
    for key in BLOCKED_EFFECTS:
        if effects.get(key) is not False:
            fail(f"{path}: {key} must be false when authority is blocked")
    if effects.get("humanReviewRequired") is not True:
        fail(f"{path}: humanReviewRequired must be true when authority is blocked")
    if record.get("claimBoundary", {}).get("customerFacingClaimAllowed") is not False:
        fail(f"{path}: customerFacingClaimAllowed must be false when authority is blocked")


def main() -> int:
    try:
        schema = load_json(SCHEMA)
        allowed = load_json(ALLOWED_FIXTURE)
        blocked = load_json(BLOCKED_FIXTURE)
        if schema.get("title") != "SCOPE-D Legal Core Decision":
            fail(f"{SCHEMA.relative_to(ROOT)}: unexpected schema title")
        validate_allowed_endpoint_triage(allowed, ALLOWED_FIXTURE)
        validate_blocked_unknown_authority(blocked, BLOCKED_FIXTURE)
    except ValidationError as exc:
        print(f"ERR: {exc}", file=sys.stderr)
        return 2
    print("OK: Legal Core fixtures passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
