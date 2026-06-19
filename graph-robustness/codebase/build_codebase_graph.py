#!/usr/bin/env python3
"""SCOPE-D Codebase Graph Builder.

Builds a directed dependency graph from a source tree using static analysis.
Current backend: Python ast module (zero-execution, no imports required).
Designed for drop-in replacement with SynapseIQ/Tree-sitter for multi-language support
when SOURCEOS_SYNAPSEIQ_URL is set (future lane — see docs/WARGAMES_TREE_SITTER_LSA_BRIDGE.md).

Emits:
  - <out>.pkl     — NetworkX DiGraph (for local visualization)
  - <out>.graphml — GraphML (for HellGraph / MeshRush import)
  - <out>.json    — GraphRobustnessAssessment evidence envelope (SCOPE-D schema)

Node types: directory, file, class, function
Edge types: contains, imports, invokes, inherits

Defensive use only. Runs on authorized repositories or local working copies.
No execution of target code. No network egress. No credential access.
"""
from __future__ import annotations

import argparse
import ast
import datetime
import json
import os
import pickle
import re
import sys
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Optional

try:
    import networkx as nx
except ImportError:
    sys.exit("networkx required: pip install networkx")

VERSION = "0.1.0"

NODE_DIRECTORY = "directory"
NODE_FILE      = "file"
NODE_CLASS     = "class"
NODE_FUNCTION  = "function"

EDGE_CONTAINS = "contains"
EDGE_IMPORTS  = "imports"
EDGE_INVOKES  = "invokes"
EDGE_INHERITS = "inherits"

SKIP_DIRS = {".git", ".github", "__pycache__", "node_modules", ".venv", "venv", "dist", "build"}


# ── static analysis helpers ───────────────────────────────────────────────────

def _resolve_import(module: str, level: int, filepath: str, repo_root: str) -> Optional[str]:
    if level == 0:
        return module
    parts = Path(os.path.relpath(filepath, repo_root)).parts
    base = list(parts[:-level]) if level <= len(parts) else []
    if module:
        base.append(module)
    return ".".join(base) if base else None


def _module_to_file(module: str, repo_root: str) -> Optional[str]:
    rel = module.replace(".", os.sep)
    for suffix in [".py", f"{os.sep}__init__.py"]:
        candidate = os.path.join(repo_root, rel + suffix)
        if os.path.exists(candidate):
            return os.path.relpath(candidate, repo_root)
    return None


class _FileAnalyzer(ast.NodeVisitor):
    def __init__(self, filepath: str, repo_root: str):
        self.filepath = filepath
        self.repo_root = repo_root
        self.rel = os.path.relpath(filepath, repo_root)
        self.nodes: list[dict] = []
        self.imports: list[dict] = []
        self._stack_name: list[str] = []
        self._stack_type: list[str] = []

    def _qualified(self, name: str) -> str:
        return ".".join(self._stack_name + [name])

    def visit_ClassDef(self, node: ast.ClassDef):
        qname = self._qualified(node.name)
        self.nodes.append({"type": NODE_CLASS, "name": qname, "file": self.rel,
                           "start": node.lineno, "end": node.end_lineno})
        bases = []
        for b in node.bases:
            if isinstance(b, ast.Name): bases.append(b.id)
            elif isinstance(b, ast.Attribute): bases.append(b.attr)
        self._stack_name.append(node.name); self._stack_type.append(NODE_CLASS)
        self.generic_visit(node)
        self._stack_name.pop(); self._stack_type.pop()
        for b in bases:
            self.imports.append({"kind": EDGE_INHERITS, "src_node": qname, "target_name": b})

    def visit_FunctionDef(self, node: ast.FunctionDef):
        qname = self._qualified(node.name)
        self.nodes.append({"type": NODE_FUNCTION, "name": qname, "file": self.rel,
                           "start": node.lineno, "end": node.end_lineno})
        self._stack_name.append(node.name); self._stack_type.append(NODE_FUNCTION)
        self.generic_visit(node)
        self._stack_name.pop(); self._stack_type.pop()

    visit_AsyncFunctionDef = visit_FunctionDef

    def visit_Call(self, node: ast.Call):
        callee = None
        if isinstance(node.func, ast.Name): callee = node.func.id
        elif isinstance(node.func, ast.Attribute): callee = node.func.attr
        if callee and self._stack_name:
            src = self._qualified("")  .rstrip(".")
            if src:
                self.imports.append({"kind": EDGE_INVOKES, "src_node": src, "target_name": callee})
        self.generic_visit(node)

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            self.imports.append({"kind": EDGE_IMPORTS, "src_node": self.rel,
                                 "module": alias.name, "level": 0})

    def visit_ImportFrom(self, node: ast.ImportFrom):
        mod = _resolve_import(node.module or "", node.level, self.filepath, self.repo_root)
        self.imports.append({"kind": EDGE_IMPORTS, "src_node": self.rel,
                             "module": mod or "", "level": node.level})


# ── graph builder ─────────────────────────────────────────────────────────────

def build_graph(repo_root: str) -> nx.DiGraph:
    G = nx.DiGraph()
    repo_root = os.path.abspath(repo_root)

    # index: qualified name -> node_id (for resolving invokes/inherits)
    name_index: dict[str, str] = {}

    # Pass 1 — structural nodes (directories, files, classes, functions)
    G.add_node("/", type=NODE_DIRECTORY, name="/", path="/")
    for dirpath, dirnames, filenames in os.walk(repo_root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        rel_dir = os.path.relpath(dirpath, repo_root)
        dir_id = "/" if rel_dir == "." else rel_dir
        if dir_id != "/":
            G.add_node(dir_id, type=NODE_DIRECTORY, name=os.path.basename(dir_id), path=dir_id)
            parent = str(Path(dir_id).parent)
            parent_id = "/" if parent == "." else parent
            G.add_edge(parent_id, dir_id, type=EDGE_CONTAINS)

        for fname in filenames:
            if not fname.endswith(".py"):
                continue
            rel_file = os.path.relpath(os.path.join(dirpath, fname), repo_root)
            G.add_node(rel_file, type=NODE_FILE, name=fname, path=rel_file)
            G.add_edge(dir_id, rel_file, type=EDGE_CONTAINS)

            try:
                src = open(os.path.join(dirpath, fname)).read()
                tree = ast.parse(src)
            except (SyntaxError, UnicodeDecodeError):
                continue

            analyzer = _FileAnalyzer(os.path.join(dirpath, fname), repo_root)
            analyzer.visit(tree)

            for n in analyzer.nodes:
                node_id = f"{rel_file}::{n['name']}"
                G.add_node(node_id, type=n["type"], name=n["name"], file=n["file"],
                           start_line=n["start"], end_line=n["end"])
                G.add_edge(rel_file, node_id, type=EDGE_CONTAINS)
                name_index[n["name"]] = node_id
                name_index[node_id] = node_id

            # stash raw import records for pass 2
            G.nodes[rel_file]["_raw_imports"] = analyzer.imports

    # Pass 2 — relational edges (imports, invokes, inherits)
    for node_id, data in list(G.nodes(data=True)):
        raw = data.pop("_raw_imports", [])
        for imp in raw:
            kind = imp["kind"]
            if kind == EDGE_IMPORTS:
                target_file = _module_to_file(imp["module"], repo_root)
                if target_file and G.has_node(target_file):
                    G.add_edge(node_id, target_file, type=EDGE_IMPORTS)
            elif kind in (EDGE_INVOKES, EDGE_INHERITS):
                target_name = imp["target_name"]
                src_node = imp["src_node"]
                # resolve: try exact match, then suffix match
                resolved = name_index.get(target_name)
                if not resolved:
                    for k, v in name_index.items():
                        if k.endswith("." + target_name) or k.endswith("::" + target_name):
                            resolved = v; break
                if resolved and G.has_node(src_node) and resolved != src_node:
                    G.add_edge(src_node, resolved, type=kind)

    return G


# ── assessment envelope ───────────────────────────────────────────────────────

def _assessment_envelope(G: nx.DiGraph, repo_root: str, source_ref: str) -> dict:
    files = [n for n, d in G.nodes(data=True) if d.get("type") == NODE_FILE]
    classes = [n for n, d in G.nodes(data=True) if d.get("type") == NODE_CLASS]
    functions = [n for n, d in G.nodes(data=True) if d.get("type") == NODE_FUNCTION]
    import_edges = [(u, v) for u, v, d in G.edges(data=True) if d.get("type") == EDGE_IMPORTS]
    invoke_edges = [(u, v) for u, v, d in G.edges(data=True) if d.get("type") == EDGE_INVOKES]

    # basic robustness metrics
    try:
        import networkx as nx
        weakly_connected = nx.number_weakly_connected_components(G)
        density = nx.density(G)
    except Exception:
        weakly_connected = -1; density = -1.0

    return {
        "schemaVersion": "0.1.0",
        "id": f"graph-robustness-codebase-{uuid.uuid4().hex[:8]}",
        "graph": {
            "graphType": "dependency_graph",
            "sourceRef": source_ref,
            "nodeCount": G.number_of_nodes(),
            "edgeCount": G.number_of_edges(),
            "builtAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        },
        "perturbationModel": {
            "type": "static_analysis_only",
            "description": "AST-derived graph; no execution, no runtime state. Robustness assessed structurally.",
            "executionRequired": False,
        },
        "robustnessScore": {
            "value": round(max(0.0, 1.0 - density), 3),
            "interpretation": "Lower density = sparser coupling = more robust to targeted removal",
            "weaklyConnectedComponents": weakly_connected,
            "graphDensity": round(density, 6),
        },
        "affectedDecisions": [
            "attack surface estimation",
            "dependency chain risk",
            "entry point enumeration",
        ],
        "summary": {
            "files": len(files),
            "classes": len(classes),
            "functions": len(functions),
            "importEdges": len(import_edges),
            "invokeEdges": len(invoke_edges),
        },
        "hardening": [
            "Review high-in-degree nodes (most-imported modules) as critical risk concentrations.",
            "Verify no wildcard imports (*) that obscure dependency surface.",
            "Consider Tree-sitter/SynapseIQ upgrade for multi-language coverage.",
        ],
        "collectorPolicy": {
            "executionMode": "static_analysis_only",
            "networkEgress": False,
            "credentialAccess": False,
            "scopeType": "authorized_local_working_copy",
        },
    }


# ── export helpers ────────────────────────────────────────────────────────────

def export_graphml(G: nx.DiGraph, path: str):
    # GraphML requires string attributes
    H = nx.DiGraph()
    for n, d in G.nodes(data=True):
        H.add_node(str(n), **{k: str(v) for k, v in d.items() if not k.startswith("_")})
    for u, v, d in G.edges(data=True):
        H.add_edge(str(u), str(v), **{k: str(v2) for k, v2 in d.items()})
    nx.write_graphml(H, path)


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="SCOPE-D codebase graph builder")
    p.add_argument("repo", help="Path to repository root")
    p.add_argument("--out", default="codebase_graph", help="Output prefix (no extension)")
    p.add_argument("--source-ref", default="", help="Git remote URL or identifier for evidence envelope")
    p.add_argument("--no-pkl", action="store_true", help="Skip .pkl output")
    p.add_argument("--no-graphml", action="store_true", help="Skip .graphml output (HellGraph/MeshRush)")
    p.add_argument("--no-assessment", action="store_true", help="Skip assessment JSON output")
    p.add_argument("--stats", action="store_true", help="Print graph stats and exit")
    args = p.parse_args()

    repo = os.path.abspath(args.repo)
    if not os.path.isdir(repo):
        sys.exit(f"Not a directory: {repo}")

    print(f"[scope-d] Building codebase graph: {repo}", flush=True)
    G = build_graph(repo)
    print(f"[scope-d] Nodes={G.number_of_nodes()} Edges={G.number_of_edges()}", flush=True)

    if args.stats:
        from collections import Counter
        tc = Counter(d.get("type") for _, d in G.nodes(data=True))
        ec = Counter(d.get("type") for _, _, d in G.edges(data=True))
        print("Node types:", dict(tc))
        print("Edge types:", dict(ec))
        return

    if not args.no_pkl:
        pkl_path = args.out + ".pkl"
        with open(pkl_path, "wb") as f:
            pickle.dump(G, f)
        print(f"[scope-d] PKL -> {pkl_path}")

    if not args.no_graphml:
        gml_path = args.out + ".graphml"
        export_graphml(G, gml_path)
        print(f"[scope-d] GraphML -> {gml_path}  (HellGraph/MeshRush ready)")

    if not args.no_assessment:
        env_path = args.out + ".assessment.json"
        env = _assessment_envelope(G, repo, args.source_ref or repo)
        with open(env_path, "w") as f:
            json.dump(env, f, indent=2)
        print(f"[scope-d] Assessment -> {env_path}")


if __name__ == "__main__":
    main()
