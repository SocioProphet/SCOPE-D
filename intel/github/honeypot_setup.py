#!/usr/bin/env python3
"""Create and manage GitHub honeypot repositories for adversary detection.

Honeypots are public repos under SocioProphet designed to attract actors who
collect AI system prompts, agent frameworks, and security tooling (e.g. the
standardgalactic network). Any star/fork/watch from a known threat-network
account is a high-confidence fingerprint hit.

Usage:
  python intel/github/honeypot_setup.py --create     # provision honeypot repos
  python intel/github/honeypot_setup.py --list        # list current honeypots
  python intel/github/honeypot_setup.py --status      # show star/fork counts
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


ORG = "SocioProphet"
WS = Path(os.path.expanduser("~/dev/gh-inventory"))

HONEYPOTS = [
    {
        "name": "agent-system-prompts",
        "description": "Collection of system prompts and tool schemas from AI coding agents — Claude Code, Cursor, Devin, Copilot",
        "topics": ["ai", "llm", "system-prompts", "claude", "agent"],
        "readme": """# Agent System Prompts

Research collection of system prompts and tool schemas from AI coding assistants.

## Included

- Claude Code (multiple versions)
- Cursor
- GitHub Copilot
- Devin

Collected for academic research on AI alignment and capability comparison.

> This repository is part of SocioProphet's AI safety research infrastructure.
""",
        "canary_files": [
            ("prompts/claude-code-internal.md", "<!-- canary:agent-system-prompts:claude-code-internal -->\n\n# Claude Code Internal Prompt\n\n*[Redacted — contact research@socioprophet.ai for access]*\n"),
            ("prompts/cursor-system.md", "<!-- canary:agent-system-prompts:cursor-system -->\n\n# Cursor System Prompt\n\n*[Redacted — contact research@socioprophet.ai for access]*\n"),
        ],
    },
    {
        "name": "hive-agent-framework",
        "description": "Multi-agent coordination framework with persistent shared memory and MCP integration",
        "topics": ["ai", "agents", "mcp", "multi-agent", "llm"],
        "readme": """# Hive Agent Framework

Distributed multi-agent coordination with persistent collective memory.

## Features

- MCP server for agent state synchronization
- Cross-session shared memory store
- Claude Code integration via MCP
- Agent hivemind coordination protocol

> This repository is part of SocioProphet's SCOPE-D hive intelligence platform.
""",
        "canary_files": [
            ("mcp/server.py", "# canary:hive-agent-framework:mcp-server\n# MCP server stub — implementation in private repo\nprint('hive-agent-framework canary')\n"),
        ],
    },
    {
        "name": "osint-codebase-scanner",
        "description": "Static AST graph builder for codebase intelligence — surfaces entry points, dependency chains, and exploit paths",
        "topics": ["osint", "security", "ast", "static-analysis", "graph"],
        "readme": """# OSINT Codebase Scanner

Builds a directed graph from source code for security intelligence:
- Entry point enumeration
- Dependency chain risk scoring
- Exploit path identification
- Multi-language via Tree-sitter

> Part of SocioProphet's SCOPE-D graph-robustness lane.
""",
        "canary_files": [
            ("scanner/build_graph.py", "# canary:osint-codebase-scanner:build-graph\n# Graph builder stub — see SCOPE-D/graph-robustness for implementation\nprint('osint-codebase-scanner canary')\n"),
        ],
    },
]


def gh_json(endpoint: str, method: str = "GET", fields: dict | None = None) -> dict | list | None:
    cmd = ["gh", "api", "--method", method, endpoint]
    if fields:
        for k, v in fields.items():
            if isinstance(v, list):
                for item in v:
                    cmd += ["-f", f"{k}[]={item}"]
            elif isinstance(v, bool):
                cmd += ["-F", f"{k}={'true' if v else 'false'}"]
            else:
                cmd += ["-f", f"{k}={v}"]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        print(f"  API error: {result.stderr.strip()}", file=sys.stderr)
        return None
    try:
        return json.loads(result.stdout)
    except Exception:
        return None


def repo_exists(name: str) -> bool:
    r = gh_json(f"repos/{ORG}/{name}")
    return r is not None and "name" in r


def create_file(repo: str, path: str, content: str, message: str):
    import base64
    encoded = base64.b64encode(content.encode()).decode()
    gh_json(
        f"repos/{ORG}/{repo}/contents/{path}",
        method="PUT",
        fields={"message": message, "content": encoded},
    )


def create_honeypot(hp: dict):
    name = hp["name"]
    print(f"\nCreating honeypot: {ORG}/{name}")

    if repo_exists(name):
        print(f"  Already exists — skipping create")
    else:
        r = gh_json("user/repos", method="POST", fields={
            "name": name,
            "description": hp["description"],
            "private": False,
            "has_issues": False,
            "has_wiki": False,
            "auto_init": True,
        })
        if not r:
            print(f"  ERROR: could not create repo")
            return

        subprocess.run(
            ["gh", "api", "--method", "PUT", f"repos/{ORG}/{name}",
             "-f", f"description={hp['description']}"],
            capture_output=True,
        )

        topics_cmd = ["gh", "api", "--method", "PUT",
                      f"repos/{ORG}/{name}/topics",
                      "-H", "Accept: application/vnd.github.mercy-preview+json"]
        for t in hp["topics"]:
            topics_cmd += ["-f", f"names[]={t}"]
        subprocess.run(topics_cmd, capture_output=True)

        print(f"  Created: https://github.com/{ORG}/{name}")

    if hp.get("readme"):
        create_file(name, "README.md", hp["readme"], "add honeypot readme")
        print(f"  Wrote README.md")

    for fpath, content in hp.get("canary_files", []):
        create_file(name, fpath, content, f"add {fpath}")
        print(f"  Wrote {fpath}")

    honeypot_record = {
        "repo": f"{ORG}/{name}",
        "url": f"https://github.com/{ORG}/{name}",
        "description": hp["description"],
        "topics": hp["topics"],
        "canary_files": [f for f, _ in hp.get("canary_files", [])],
        "created": "2026-06-19",
    }
    out = WS / "raw" / "honeypots.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)
    existing = set()
    if out.exists():
        for line in out.read_text().splitlines():
            try:
                existing.add(json.loads(line)["repo"])
            except Exception:
                pass
    if honeypot_record["repo"] not in existing:
        with open(out, "a") as f:
            f.write(json.dumps(honeypot_record) + "\n")

    print(f"  Registered in {out}")


def list_honeypots():
    out = WS / "raw" / "honeypots.jsonl"
    if not out.exists():
        print("No honeypots registered. Run --create first.")
        return []
    hps = []
    for line in out.read_text().splitlines():
        try:
            hps.append(json.loads(line))
        except Exception:
            pass
    for hp in hps:
        print(f"  {hp['repo']} — {hp['description'][:60]}")
    return hps


def status():
    hps = list_honeypots()
    print()
    for hp in hps:
        repo = hp["repo"]
        r = gh_json(f"repos/{repo}")
        if r:
            print(f"{repo}")
            print(f"  stars={r.get('stargazers_count',0)}  forks={r.get('forks_count',0)}  watchers={r.get('watchers_count',0)}")
            stars = gh_json(f"repos/{repo}/stargazers") or []
            if stars:
                print(f"  stargazers: {[s['login'] for s in stars]}")
            forks = gh_json(f"repos/{repo}/forks") or []
            if forks:
                print(f"  forkers:    {[f['owner']['login'] for f in forks]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--create", action="store_true")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--status", action="store_true")
    args = ap.parse_args()

    if args.create:
        for hp in HONEYPOTS:
            create_honeypot(hp)
    elif args.status:
        status()
    else:
        list_honeypots()


if __name__ == "__main__":
    main()
