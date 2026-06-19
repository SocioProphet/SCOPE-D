#!/usr/bin/env python3
"""MCP integrity checker for SCOPE-D authorized-mcp-discovery lane.

Reads installed Claude Code MCP server configs, cross-checks against known
threat actor list, detects impersonation patterns, and flags shared-state access.

Outputs: JSON record conforming to authorized-mcp-discovery-run.schema.json
Usage:   python ai-infra/mcp-risk/mcp_integrity_check.py [--config-dir ~/.claude]
"""
import argparse
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path


THREAT_ACTOR_ORGS = {
    "standardgalactic",
    "mcp-hetzner",
}

THREAT_ACTOR_REPOS = {
    "standardgalactic/agent-hivemind",
    "standardgalactic/openended-philosophy-mcp",
    "standardgalactic/mcp-hetzner",
}

IMPERSONATION_PATTERNS = [
    re.compile(r"\bclaude\s*ops\b", re.I),
    re.compile(r"\bgeminigops\b", re.I),
    re.compile(r"\bhive\s*mind\b", re.I),
    re.compile(r"\bcollective\s*memory\b", re.I),
    re.compile(r"\bdistributed\s*memory\b", re.I),
    re.compile(r"\bcoordinator\b", re.I),
    re.compile(r"\borchestrator\b", re.I),
    re.compile(r"\bswarm\b", re.I),
]

SHARED_STATE_PATTERNS = [
    re.compile(r"\bpersistent\s*(state|memory|store)\b", re.I),
    re.compile(r"\bcross.session\b", re.I),
    re.compile(r"\bglobal\s*(memory|state|store)\b", re.I),
    re.compile(r"\bshared\s*(memory|state|store)\b", re.I),
]


def find_mcp_configs(config_dir: Path) -> list[Path]:
    candidates = [
        config_dir / "settings.json",
        config_dir / "mcp_servers.json",
        Path.home() / ".cursor" / "mcp.json",
        Path.home() / ".config" / "claude" / "claude_desktop_config.json",
    ]
    return [p for p in candidates if p.exists()]


def extract_servers(config_path: Path) -> list[dict]:
    try:
        raw = json.loads(config_path.read_text())
    except Exception:
        return []
    servers = []
    for key in ("mcpServers", "mcp_servers", "servers"):
        block = raw.get(key, {})
        if isinstance(block, dict):
            for name, cfg in block.items():
                servers.append({"name": name, "config": cfg, "source": str(config_path)})
        elif isinstance(block, list):
            for item in block:
                servers.append({"name": item.get("name", ""), "config": item, "source": str(config_path)})
    return servers


def classify_server(name: str, cfg: dict) -> dict:
    findings = []
    risk = "trusted"

    command = cfg.get("command", "")
    args = " ".join(str(a) for a in cfg.get("args", []))
    description = cfg.get("description", "") + " " + cfg.get("env", {}).get("DESCRIPTION", "")
    full_text = f"{name} {command} {args} {description}".lower()

    owner = ""
    repo = ""
    if "github.com/" in full_text:
        m = re.search(r"github\.com/([^/]+)/([^/\s\"]+)", full_text)
        if m:
            owner = m.group(1).lower()
            repo_full = f"{owner}/{m.group(2).lower()}"
            if owner in THREAT_ACTOR_ORGS:
                findings.append({"type": "threat_actor_owner", "detail": owner, "severity": "HIGH"})
                risk = "BLOCKED"
            if repo_full in THREAT_ACTOR_REPOS:
                findings.append({"type": "threat_actor_repo", "detail": repo_full, "severity": "HIGH"})
                risk = "BLOCKED"

    for pat in IMPERSONATION_PATTERNS:
        if pat.search(full_text):
            findings.append({"type": "impersonation_signal", "detail": pat.pattern, "severity": "HIGH"})
            risk = max(risk, "REVIEW") if risk == "trusted" else risk

    for pat in SHARED_STATE_PATTERNS:
        if pat.search(full_text):
            findings.append({"type": "shared_state_access", "detail": pat.pattern, "severity": "MEDIUM"})
            if risk == "trusted":
                risk = "REVIEW"

    return {"name": name, "owner": owner, "risk": risk, "findings": findings}


def check_all(config_dir: Path) -> dict:
    config_paths = find_mcp_configs(config_dir)
    all_servers = []
    for p in config_paths:
        all_servers.extend(extract_servers(p))

    results = [classify_server(s["name"], s["config"]) for s in all_servers]

    blocked = [r for r in results if r["risk"] == "BLOCKED"]
    review = [r for r in results if r["risk"] == "REVIEW"]
    trusted = [r for r in results if r["risk"] == "trusted"]

    overall_decision = "BLOCKED" if blocked else ("REVIEW_REQUIRED" if review else "PASS")

    record = {
        "schemaVersion": "0.1.0",
        "runId": str(uuid.uuid4()),
        "requestRef": "mcp_integrity_check.py:local",
        "policyRef": "ai-infra/mcp-risk/STANDARDGALACTIC-MCP.md",
        "decisionRef": "mcp_integrity_check.py",
        "decision": overall_decision,
        "discoverySourceRef": [str(p) for p in config_paths],
        "surfaceManifestRef": None,
        "surfaceRunIndexRef": None,
        "surfaceAssessmentRef": None,
        "riskRecordsRef": results,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "liveConnectionUsed": False,
        "executionAllowed": overall_decision == "PASS",
        "executionPerformed": False,
        "summary": {
            "total_servers": len(results),
            "blocked": len(blocked),
            "review_required": len(review),
            "trusted": len(trusted),
        },
    }
    return record


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config-dir", default=os.path.expanduser("~/.claude"))
    ap.add_argument("--out", help="Write JSON record to this file")
    ap.add_argument("--strict", action="store_true", help="Exit non-zero if any BLOCKED or REVIEW findings")
    args = ap.parse_args()

    record = check_all(Path(args.config_dir))

    out_json = json.dumps(record, indent=2)
    if args.out:
        Path(args.out).write_text(out_json)
        print(f"Wrote: {args.out}", file=sys.stderr)
    else:
        print(out_json)

    s = record["summary"]
    print(
        f"\nMCP integrity: {record['decision']} — "
        f"{s['total_servers']} servers, {s['blocked']} blocked, "
        f"{s['review_required']} review, {s['trusted']} trusted",
        file=sys.stderr,
    )

    if args.strict and record["decision"] != "PASS":
        sys.exit(1)


if __name__ == "__main__":
    main()
