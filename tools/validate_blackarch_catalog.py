#!/usr/bin/env python3
"""Validate SCOPE-D BlackArch catalog safety invariants.

This validator intentionally avoids external dependencies. It performs structural
and policy checks that matter for the BlackArch cannibalization lane:

- catalog is metadata-only
- production execution remains blocked
- every record has provenance, safety, execution, and evidence sections
- every record requires a wrapper before any future execution path
- unknown or restricted records cannot become read-only or sandboxed by accident
- declared recordCount matches the records array

It does not install, build, run, or inspect upstream tools.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ALLOWED_TOP_LEVEL_KEYS = {
    "schemaVersion",
    "kind",
    "sourceCorpus",
    "generatedAt",
    "sourceRoot",
    "sourceCommit",
    "recordCount",
    "records",
    "policy",
}

REQUIRED_RECORD_KEYS = {
    "schemaVersion",
    "toolId",
    "name",
    "sourceCorpus",
    "categories",
    "provenance",
    "safety",
    "execution",
    "evidence",
}

VALID_SAFETY_CLASSES = {
    "allow_defensive",
    "lab_gated",
    "restricted_catalog_only",
    "blocked_runtime",
    "unknown_review_required",
}

VALID_EXECUTION_MODES = {
    "catalog_only",
    "synthetic_only",
    "read_only",
    "sandboxed_lab",
    "blocked",
}

NON_RUNTIME_SAFETY_CLASSES = {
    "restricted_catalog_only",
    "blocked_runtime",
    "unknown_review_required",
}

FORBIDDEN_DEFAULTS_FOR_NON_RUNTIME = {
    "read_only",
    "sandboxed_lab",
}


class ValidationError(Exception):
    pass


def fail(path: str, message: str) -> None:
    raise ValidationError(f"{path}: {message}")


def require_type(path: str, value: Any, expected_type: type) -> None:
    if not isinstance(value, expected_type):
        fail(path, f"expected {expected_type.__name__}, got {type(value).__name__}")


def validate_catalog(catalog: dict[str, Any]) -> list[str]:
    warnings: list[str] = []

    extra_keys = set(catalog) - ALLOWED_TOP_LEVEL_KEYS
    if extra_keys:
        fail("$", f"unexpected top-level keys: {sorted(extra_keys)}")

    if catalog.get("schemaVersion") != "0.1.0":
        fail("$.schemaVersion", "must be 0.1.0")
    if catalog.get("kind") != "ScopeDBlackArchCatalog":
        fail("$.kind", "must be ScopeDBlackArchCatalog")
    if catalog.get("sourceCorpus") != "blackarch":
        fail("$.sourceCorpus", "must be blackarch")

    records = catalog.get("records")
    require_type("$.records", records, list)

    record_count = catalog.get("recordCount")
    require_type("$.recordCount", record_count, int)
    if record_count != len(records):
        fail("$.recordCount", f"declares {record_count}, but records contains {len(records)}")

    policy = catalog.get("policy", {})
    if policy:
        require_type("$.policy", policy, dict)
        if policy.get("runtimeAuthorization") not in (None, "not_authorized"):
            fail("$.policy.runtimeAuthorization", "catalog must not authorize runtime")
        if policy.get("productionAllowed") not in (None, False):
            fail("$.policy.productionAllowed", "catalog must not allow production")

    seen_tool_ids: set[str] = set()
    for index, record in enumerate(records):
        validate_record(record, f"$.records[{index}]", seen_tool_ids, warnings)

    return warnings


def validate_record(record: Any, path: str, seen_tool_ids: set[str], warnings: list[str]) -> None:
    require_type(path, record, dict)
    missing = REQUIRED_RECORD_KEYS - set(record)
    if missing:
        fail(path, f"missing required keys: {sorted(missing)}")

    if record.get("schemaVersion") != "0.1.0":
        fail(f"{path}.schemaVersion", "must be 0.1.0")
    if record.get("sourceCorpus") != "blackarch":
        fail(f"{path}.sourceCorpus", "must be blackarch")

    tool_id = record.get("toolId")
    require_type(f"{path}.toolId", tool_id, str)
    if tool_id in seen_tool_ids:
        fail(f"{path}.toolId", f"duplicate toolId {tool_id}")
    seen_tool_ids.add(tool_id)

    categories = record.get("categories")
    require_type(f"{path}.categories", categories, list)
    if not categories:
        fail(f"{path}.categories", "must not be empty")

    provenance = record.get("provenance")
    require_type(f"{path}.provenance", provenance, dict)
    if not provenance.get("sourceRef"):
        fail(f"{path}.provenance.sourceRef", "must be present")
    if provenance.get("claimLevel") not in {"extracted", "inferred", "reviewed", "rejected"}:
        fail(f"{path}.provenance.claimLevel", "invalid claim level")

    safety = record.get("safety")
    require_type(f"{path}.safety", safety, dict)
    safety_class = safety.get("safetyClass")
    if safety_class not in VALID_SAFETY_CLASSES:
        fail(f"{path}.safety.safetyClass", f"invalid safety class {safety_class!r}")

    review_status = safety.get("reviewStatus")
    if review_status not in {"unreviewed", "machine_classified", "human_reviewed", "approved", "rejected"}:
        fail(f"{path}.safety.reviewStatus", f"invalid review status {review_status!r}")

    risk_signals = safety.get("riskSignals")
    require_type(f"{path}.safety.riskSignals", risk_signals, dict)
    for key in (
        "requiresNetwork",
        "requiresRoot",
        "requiresRawSocket",
        "requiresCaptureDevice",
        "mayMutateTarget",
        "mayHandleSecrets",
        "mayContactExternalServices",
        "physicalDomain",
    ):
        if key not in risk_signals:
            fail(f"{path}.safety.riskSignals", f"missing {key}")
        if not isinstance(risk_signals[key], bool):
            fail(f"{path}.safety.riskSignals.{key}", "must be boolean")

    execution = record.get("execution")
    require_type(f"{path}.execution", execution, dict)
    default_mode = execution.get("defaultMode")
    if default_mode not in VALID_EXECUTION_MODES:
        fail(f"{path}.execution.defaultMode", f"invalid execution mode {default_mode!r}")

    allowed_modes = execution.get("allowedModes")
    require_type(f"{path}.execution.allowedModes", allowed_modes, list)
    invalid_modes = set(allowed_modes) - VALID_EXECUTION_MODES
    if invalid_modes:
        fail(f"{path}.execution.allowedModes", f"invalid modes: {sorted(invalid_modes)}")
    if default_mode not in allowed_modes:
        fail(f"{path}.execution.allowedModes", "must include defaultMode")

    if execution.get("productionAllowed") is not False:
        fail(f"{path}.execution.productionAllowed", "must be false")
    if execution.get("wrapperRequired") is not True:
        fail(f"{path}.execution.wrapperRequired", "must be true")

    if safety_class in NON_RUNTIME_SAFETY_CLASSES and default_mode in FORBIDDEN_DEFAULTS_FOR_NON_RUNTIME:
        fail(
            f"{path}.execution.defaultMode",
            f"{safety_class} record cannot default to {default_mode}",
        )

    if safety_class == "allow_defensive" and risk_signals.get("physicalDomain"):
        warnings.append(f"{path}: allow_defensive record has physicalDomain=true")

    evidence = record.get("evidence")
    require_type(f"{path}.evidence", evidence, dict)
    evidence_types = evidence.get("expectedEvidenceTypes")
    require_type(f"{path}.evidence.expectedEvidenceTypes", evidence_types, list)
    if not evidence_types:
        fail(f"{path}.evidence.expectedEvidenceTypes", "must not be empty")
    if evidence.get("rawOutputAllowed") is True:
        fail(f"{path}.evidence.rawOutputAllowed", "raw output must not be allowed in mined catalog records")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Validate a SCOPE-D BlackArch catalog JSON file.")
    parser.add_argument("catalog", type=Path, help="Catalog JSON emitted by tools/blackarch_readonly_miner.py")
    args = parser.parse_args(argv)

    try:
        catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
        if not isinstance(catalog, dict):
            fail("$", "catalog root must be an object")
        warnings = validate_catalog(catalog)
    except (OSError, json.JSONDecodeError, ValidationError) as exc:
        print(f"validation failed: {exc}", file=sys.stderr)
        return 1

    for warning in warnings:
        print(f"warning: {warning}", file=sys.stderr)
    print(f"validated {catalog.get('recordCount', 0)} BlackArch catalog records")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
