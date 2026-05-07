#!/usr/bin/env python3
"""Read-only BlackArch metadata miner for SCOPE-D.

This utility converts local BlackArch PKGBUILD metadata into SCOPE-D security-tool
catalog records. It is intentionally non-executing: it does not install packages,
build packages, run tools, invoke makepkg, or contact external services.

Input:  local checkout of a BlackArch-style repository
Output: JSON catalog records conforming to config/schemas/security-tool.schema.json
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable


ARRAY_ASSIGNMENT_RE = re.compile(r"^(?P<key>[A-Za-z_][A-Za-z0-9_]*)=\((?P<value>.*)\)\s*$")
STRING_ASSIGNMENT_RE = re.compile(r"^(?P<key>[A-Za-z_][A-Za-z0-9_]*)=(?P<value>.+?)\s*$")
SHELL_TOKEN_RE = re.compile(r"'([^']*)'|\"([^\"]*)\"|([^\s]+)")

CATEGORY_CAPABILITY_MAP = {
    "blackarch-defensive": ("defensive_host_assessment", "allow_defensive", "read_only"),
    "blackarch-code-audit": ("code_audit", "allow_defensive", "read_only"),
    "blackarch-forensic": ("forensic_analysis", "allow_defensive", "sandboxed_lab"),
    "blackarch-ids": ("defensive_host_assessment", "allow_defensive", "read_only"),
    "blackarch-threat-model": ("threat_modeling", "allow_defensive", "read_only"),
    "blackarch-scanner": ("authorized_scanning", "lab_gated", "synthetic_only"),
    "blackarch-webapp": ("webapp_validation", "lab_gated", "synthetic_only"),
    "blackarch-networking": ("network_analysis", "lab_gated", "sandboxed_lab"),
    "blackarch-sniffer": ("network_analysis", "lab_gated", "sandboxed_lab"),
    "blackarch-fuzzer": ("fuzz_validation", "lab_gated", "sandboxed_lab"),
    "blackarch-reversing": ("reverse_engineering", "lab_gated", "sandboxed_lab"),
    "blackarch-disassembler": ("reverse_engineering", "lab_gated", "sandboxed_lab"),
    "blackarch-decompiler": ("reverse_engineering", "lab_gated", "sandboxed_lab"),
    "blackarch-debugger": ("reverse_engineering", "lab_gated", "sandboxed_lab"),
    "blackarch-binary": ("reverse_engineering", "lab_gated", "sandboxed_lab"),
    "blackarch-firmware": ("hardware_lab", "lab_gated", "sandboxed_lab"),
    "blackarch-hardware": ("hardware_lab", "lab_gated", "sandboxed_lab"),
    "blackarch-ai": ("ai_infra_assessment", "lab_gated", "synthetic_only"),
}

PHYSICAL_DOMAIN_CATEGORIES = {
    "blackarch-automobile",
    "blackarch-bluetooth",
    "blackarch-drone",
    "blackarch-nfc",
    "blackarch-radio",
    "blackarch-voip",
    "blackarch-wireless",
}

RESTRICTED_CATEGORY_HINTS = {
    "blackarch-anti-forensic",
    "blackarch-backdoor",
    "blackarch-cracker",
    "blackarch-dos",
    "blackarch-exploitation",
    "blackarch-keylogger",
    "blackarch-malware",
    "blackarch-packer",
    "blackarch-social",
    "blackarch-spoof",
    "blackarch-tunnel",
    "blackarch-unpacker",
    "blackarch-windows",
}

NETWORK_HINTS = {
    "blackarch-scanner",
    "blackarch-webapp",
    "blackarch-networking",
    "blackarch-sniffer",
    "blackarch-recon",
    "blackarch-proxy",
    "blackarch-wireless",
    "blackarch-radio",
    "blackarch-voip",
    "blackarch-bluetooth",
    "blackarch-nfc",
}

RAW_SOCKET_HINTS = {
    "blackarch-sniffer",
    "blackarch-networking",
    "blackarch-wireless",
    "blackarch-radio",
}


def _now_iso() -> str:
    return _dt.datetime.now(_dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _shell_tokens(value: str) -> list[str]:
    tokens: list[str] = []
    for match in SHELL_TOKEN_RE.finditer(value.strip()):
        token = next(group for group in match.groups() if group is not None)
        token = token.strip()
        if token and token != "\\":
            tokens.append(token)
    return tokens


def _strip_inline_comment(line: str) -> str:
    in_single = False
    in_double = False
    out: list[str] = []
    for char in line:
        if char == "'" and not in_double:
            in_single = not in_single
        elif char == '"' and not in_single:
            in_double = not in_double
        elif char == "#" and not in_single and not in_double:
            break
        out.append(char)
    return "".join(out).strip()


def parse_pkgbuild(path: Path) -> dict[str, Any]:
    """Parse common PKGBUILD scalar and array assignments without sourcing shell."""
    result: dict[str, Any] = {}
    logical_lines: list[str] = []
    buffer = ""

    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = _strip_inline_comment(raw_line)
        if not line:
            continue
        buffer = f"{buffer} {line}".strip() if buffer else line
        if buffer.endswith("\\"):
            buffer = buffer[:-1].strip()
            continue
        logical_lines.append(buffer)
        buffer = ""

    for line in logical_lines:
        array_match = ARRAY_ASSIGNMENT_RE.match(line)
        if array_match:
            result[array_match.group("key")] = _shell_tokens(array_match.group("value"))
            continue

        string_match = STRING_ASSIGNMENT_RE.match(line)
        if string_match:
            key = string_match.group("key")
            raw_value = string_match.group("value").strip()
            if raw_value.startswith(("'", '"')) and raw_value.endswith(("'", '"')):
                raw_value = raw_value[1:-1]
            result[key] = raw_value

    return result


def classify_categories(categories: Iterable[str]) -> tuple[list[str], str, str, list[str], str]:
    category_set = set(categories)
    capabilities: set[str] = set()
    safety_class = "unknown_review_required"
    default_mode = "catalog_only"
    required_gates: set[str] = {"human_operator_review"}
    rationale_parts: list[str] = []

    if category_set & RESTRICTED_CATEGORY_HINTS:
        capabilities.add("restricted_taxonomy")
        safety_class = "restricted_catalog_only"
        default_mode = "synthetic_only"
        required_gates.update({"synthetic_only_enforcement", "human_operator_review"})
        rationale_parts.append("category has restricted-use signals; defaulting to synthetic/catalog handling")

    if category_set & PHYSICAL_DOMAIN_CATEGORIES:
        capabilities.add("hardware_lab")
        safety_class = "lab_gated" if safety_class == "unknown_review_required" else safety_class
        default_mode = "sandboxed_lab" if default_mode == "catalog_only" else default_mode
        required_gates.update({"physical_domain_authorization", "hardware_lab_authorization"})
        rationale_parts.append("category touches physical-domain or hardware-adjacent surfaces")

    for category in category_set:
        mapped = CATEGORY_CAPABILITY_MAP.get(category)
        if not mapped:
            continue
        capability, mapped_safety, mapped_mode = mapped
        capabilities.add(capability)
        if safety_class == "unknown_review_required":
            safety_class = mapped_safety
        if default_mode == "catalog_only":
            default_mode = mapped_mode
        required_gates.add("scope_approval")
        if mapped_safety == "lab_gated":
            required_gates.add("tool_authorization")
        rationale_parts.append(f"{category} maps to {capability}")

    if not capabilities:
        capabilities.add("unknown")
        rationale_parts.append("no category mapping found")

    if category_set & NETWORK_HINTS:
        required_gates.add("network_authorization")
    if category_set & RAW_SOCKET_HINTS:
        required_gates.add("raw_socket_authorization")

    return sorted(capabilities), safety_class, default_mode, sorted(required_gates), "; ".join(rationale_parts)


def build_record(pkgbuild_path: Path, repo_root: Path, observed_at: str) -> dict[str, Any]:
    pkg = parse_pkgbuild(pkgbuild_path)
    pkgname = str(pkg.get("pkgname") or pkgbuild_path.parent.name)
    categories = [str(item) for item in pkg.get("groups", [])] or ["blackarch"]
    capabilities, safety_class, default_mode, gates, rationale = classify_categories(categories)
    category_set = set(categories)

    risk_signals = {
        "requiresNetwork": bool(category_set & NETWORK_HINTS),
        "requiresRoot": bool(category_set & (RAW_SOCKET_HINTS | PHYSICAL_DOMAIN_CATEGORIES)),
        "requiresRawSocket": bool(category_set & RAW_SOCKET_HINTS),
        "requiresCaptureDevice": bool(category_set & (RAW_SOCKET_HINTS | PHYSICAL_DOMAIN_CATEGORIES)),
        "mayMutateTarget": safety_class in {"lab_gated", "restricted_catalog_only"},
        "mayHandleSecrets": safety_class in {"restricted_catalog_only", "blocked_runtime"},
        "mayContactExternalServices": bool(category_set & NETWORK_HINTS),
        "physicalDomain": bool(category_set & PHYSICAL_DOMAIN_CATEGORIES),
    }

    allowed_modes = ["catalog_only"]
    if default_mode not in allowed_modes:
        allowed_modes.append(default_mode)
    if safety_class == "allow_defensive" and "read_only" not in allowed_modes:
        allowed_modes.append("read_only")
    if safety_class == "restricted_catalog_only" and "synthetic_only" not in allowed_modes:
        allowed_modes.append("synthetic_only")

    checksums = {
        key: value
        for key, value in pkg.items()
        if key.endswith("sums") and isinstance(value, list)
    }

    rel_path = pkgbuild_path.relative_to(repo_root).as_posix()
    return {
        "schemaVersion": "0.1.0",
        "toolId": f"tool-blackarch-{re.sub(r'[^a-z0-9._:-]+', '-', pkgname.lower())}",
        "name": pkgname,
        "description": str(pkg.get("pkgdesc", "")),
        "sourceCorpus": "blackarch",
        "categories": categories,
        "capabilities": capabilities,
        "provenance": {
            "sourceRef": rel_path,
            "upstreamUrl": str(pkg.get("url", "")),
            "packagePath": rel_path,
            "observedAt": observed_at,
            "claimLevel": "extracted",
        },
        "package": {
            "pkgname": pkgname,
            "pkgver": str(pkg.get("pkgver", "")),
            "pkgrel": str(pkg.get("pkgrel", "")),
            "arch": [str(item) for item in pkg.get("arch", [])] if isinstance(pkg.get("arch"), list) else [],
            "url": str(pkg.get("url", "")),
            "license": [str(item) for item in pkg.get("license", [])] if isinstance(pkg.get("license"), list) else [],
            "depends": [str(item) for item in pkg.get("depends", [])] if isinstance(pkg.get("depends"), list) else [],
            "makedepends": [str(item) for item in pkg.get("makedepends", [])] if isinstance(pkg.get("makedepends"), list) else [],
            "optdepends": [str(item) for item in pkg.get("optdepends", [])] if isinstance(pkg.get("optdepends"), list) else [],
            "source": [str(item) for item in pkg.get("source", [])] if isinstance(pkg.get("source"), list) else [],
            "checksums": checksums,
        },
        "safety": {
            "safetyClass": safety_class,
            "reviewStatus": "machine_classified",
            "riskSignals": risk_signals,
            "rationale": rationale,
            "requiredGates": gates,
        },
        "execution": {
            "defaultMode": default_mode,
            "allowedModes": allowed_modes,
            "wrapperRequired": True,
            "productionAllowed": False,
        },
        "mappings": {
            "mitreAttack": [],
            "mitreAtlas": [],
            "d3fend": [],
            "cwe": [],
            "capec": [],
        },
        "evidence": {
            "expectedEvidenceTypes": ["metadata_only", "policy_decision", "run_receipt"],
            "redactionRequired": True,
            "rawOutputAllowed": False,
            "parserRef": "scope-d.blackarch.metadata-only",
        },
        "notes": [
            "Generated by read-only metadata miner.",
            "This record does not authorize package installation or tool execution.",
        ],
    }


def iter_pkgbuilds(repo_root: Path) -> Iterable[Path]:
    for base in (repo_root / "packages", repo_root / "aur"):
        if not base.exists():
            continue
        yield from sorted(base.glob("*/PKGBUILD"))


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Mine local BlackArch PKGBUILD metadata into SCOPE-D catalog JSON.")
    parser.add_argument("repo", type=Path, help="Path to local BlackArch checkout")
    parser.add_argument("--out", type=Path, default=Path("blackarch-security-tools.json"), help="Output JSON path")
    parser.add_argument("--limit", type=int, default=0, help="Optional limit for smoke tests")
    args = parser.parse_args(argv)

    repo_root = args.repo.resolve()
    if not (repo_root / "lists" / "groups").exists():
        print(f"error: {repo_root} does not look like a BlackArch checkout", file=sys.stderr)
        return 2

    observed_at = _now_iso()
    records = []
    for index, pkgbuild in enumerate(iter_pkgbuilds(repo_root)):
        if args.limit and index >= args.limit:
            break
        records.append(build_record(pkgbuild, repo_root, observed_at))

    output = {
        "schemaVersion": "0.1.0",
        "kind": "ScopeDBlackArchCatalog",
        "sourceCorpus": "blackarch",
        "generatedAt": observed_at,
        "sourceRoot": str(repo_root),
        "recordCount": len(records),
        "records": records,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(output, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {len(records)} records to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
