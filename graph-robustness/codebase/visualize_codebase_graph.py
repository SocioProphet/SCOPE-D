#!/usr/bin/env python3
"""SCOPE-D Codebase Graph Visualizer.

Queries a .pkl codebase graph (built by build_codebase_graph.py) and renders
bidirectional neighborhood views as PNG (Graphviz) or plain text.

Derived from SeeRepo graph_visualization (Apache-2.0, standardgalactic/SeeRepo).
Adapted for SCOPE-D: added text-first defaults, removed mini-swe-agent coupling,
added SCOPE-D evidence logging.

Usage:
    python visualize_codebase_graph.py \\
        --pkl codebase_graph.pkl \\
        --node src/foo.py \\
        --edge-type imports \\
        --up-depth 1 --down-depth 2 \\
        --text
"""
from __future__ import annotations

import argparse
import json
import os
import pickle
import re
import sys
import time
from collections import deque
from pathlib import Path
from typing import Any, Dict, Optional, Set, Tuple

try:
    import networkx as nx
except ImportError:
    sys.exit("networkx required: pip install networkx")

EDGE_CONTAINS = "contains"
EDGE_IMPORTS  = "imports"
EDGE_INVOKES  = "invokes"
EDGE_INHERITS = "inherits"
NODE_TYPE_KEY = "type"
EDGE_TYPE_KEY = "type"

ICON = {
    "directory": "📁", "file": "📄", "class": "🧩", "function": "⚙️",
}
PRIORITY = {"directory": 0, "file": 1, "class": 2, "function": 3}
NODE_NAME_KEYS = ["name", "path"]


def _node_name(node_id: Any, data: dict) -> str:
    for k in NODE_NAME_KEYS:
        v = data.get(k)
        if v: return str(v)
    return str(node_id)


def _extract_edge_subgraph(G: nx.DiGraph, edge_type: str) -> nx.DiGraph:
    H = nx.DiGraph()
    for u, v, d in G.edges(data=True):
        if d.get(EDGE_TYPE_KEY) == edge_type:
            H.add_edge(u, v)
    for n, d in G.nodes(data=True):
        if n in H:
            H.nodes[n].update(d)
    return H


def _collect_bidir(H: nx.DiGraph, center: Any, up: int, down: int) -> Tuple[Set[Any], Dict[Any, int]]:
    if center not in H:
        raise KeyError(f"Node not found in graph: {center!r}")
    nodes: Set[Any] = {center}
    dist: Dict[Any, int] = {center: 0}

    q = deque([(center, 0)]); seen = {center}
    while q:
        u, d = q.popleft()
        if d >= up: continue
        for p in H.predecessors(u):
            if p in seen: continue
            seen.add(p); nodes.add(p)
            dist[p] = min(dist.get(p, 10**9), -(d+1))
            q.append((p, d+1))

    q = deque([(center, 0)]); seen = {center}
    while q:
        u, d = q.popleft()
        if d >= down: continue
        for v in H.successors(u):
            if v in seen: continue
            seen.add(v); nodes.add(v)
            dist[v] = min(dist.get(v, 10**9), d+1)
            q.append((v, d+1))

    return nodes, dist


def render_text(G: nx.DiGraph, center: str, edge_type: str, up: int, down: int) -> str:
    H = _extract_edge_subgraph(G, edge_type)
    if center not in H:
        if center in G:
            H.add_node(center, **G.nodes[center])
        else:
            raise KeyError(f"Node not found: {center!r}")
    nodes, dist = _collect_bidir(H, center, up, down)

    upstream = sorted([n for n, d in dist.items() if d < 0],
                      key=lambda n: (dist[n], _node_name(n, H.nodes.get(n, {}))))
    downstream: Dict[int, list] = {}
    for n, d in dist.items():
        if d > 0: downstream.setdefault(d, []).append(n)

    UP_LABEL = {EDGE_IMPORTS: "imported by", EDGE_INVOKES: "callers", EDGE_INHERITS: "subclasses", EDGE_CONTAINS: "parent"}
    DN_LABEL = {EDGE_IMPORTS: "imports", EDGE_INVOKES: "calls", EDGE_INHERITS: "base classes", EDGE_CONTAINS: "children"}

    lines = [f"[{edge_type} graph | center: {center} | ↑{up} ↓{down}]", ""]
    if upstream:
        lines += [f"▲ UPSTREAM ({UP_LABEL.get(edge_type,'upstream')}):"]
        for n in upstream:
            t = H.nodes.get(n, {}).get("type","?")
            lines.append(f"  {ICON.get(t,'•')} {_node_name(n, H.nodes.get(n,{}))}")
        lines.append("")
    lines += ["● CENTER:", f"  {ICON.get(H.nodes.get(center,{}).get('type','?'),'•')} {_node_name(center, H.nodes.get(center,{}))}"]
    if downstream:
        lines.append("")
        lines += [f"▼ DOWNSTREAM ({DN_LABEL.get(edge_type,'downstream')}):"]
        for d in sorted(downstream):
            ns = sorted(downstream[d], key=lambda n: (PRIORITY.get(H.nodes.get(n,{}).get("type","?"),9), _node_name(n, H.nodes.get(n,{}))))
            if len(downstream) > 1: lines.append(f"  [depth={d}]")
            for n in ns:
                t = H.nodes.get(n, {}).get("type","?")
                lines.append(f"  {'  ' if len(downstream)>1 else ''}{ICON.get(t,'•')} {_node_name(n, H.nodes.get(n, {}))}")
    return "\n".join(lines)


def render_png(G: nx.DiGraph, center: str, edge_type: str, up: int, down: int, out_prefix: str) -> str:
    try:
        from graphviz import Digraph as GvDigraph
    except ImportError:
        sys.exit("graphviz python package required: pip install graphviz (+ apt install graphviz)")

    H = _extract_edge_subgraph(G, edge_type)
    if center not in H and center in G:
        H.add_node(center, **G.nodes[center])
    nodes, dist = _collect_bidir(H, center, up, down)

    def dot_id(n): return f"n_{abs(hash(n))}"
    def label(n):
        d = H.nodes.get(n, {}); t = d.get("type","?"); nm = _node_name(n, d)
        return f'<<TABLE BORDER="0"><TR><TD>{ICON.get(t,"•")}</TD><TD>{nm}</TD></TR></TABLE>>'

    dot = GvDigraph(f"{edge_type}_bidir", format="png", engine="dot")
    dot.attr("graph", rankdir="LR", splines="ortho", nodesep="0.25", ranksep="0.9")
    dot.attr("node", shape="plain", fontname="Helvetica", fontsize="11")
    dot.attr("edge", color="#777777", arrowhead="normal", arrowsize="0.7")

    for n in nodes:
        kw = {"label": label(n)}
        if n == center: kw.update(style="filled", fillcolor="#FFF2CC")
        dot.node(dot_id(n), **kw)

    for u in nodes:
        children = [v for v in H.successors(u) if v in nodes]
        if not children: continue
        is_relational = edge_type != EDGE_CONTAINS
        if is_relational:
            children = [v for v in children if v == center or u == center]
        for v in children:
            dot.edge(dot_id(u), dot_id(v))

    layers: Dict[int, list] = {}
    for n, d in dist.items():
        layers.setdefault(d, []).append(n)
    for d, ns in layers.items():
        with dot.subgraph(name=f"rank_{d}") as s:
            s.attr(rank="same")
            for n in ns: s.node(dot_id(n))

    out = dot.render(out_prefix, cleanup=True)
    return out


def main():
    p = argparse.ArgumentParser(description="SCOPE-D codebase graph visualizer")
    p.add_argument("--pkl", required=True, help="Path to codebase_graph.pkl")
    p.add_argument("--node", default="/", help="Center node (file path, class, or function id)")
    p.add_argument("--edge-type", default=EDGE_CONTAINS,
                   choices=[EDGE_CONTAINS, EDGE_IMPORTS, EDGE_INVOKES, EDGE_INHERITS])
    p.add_argument("--up-depth", type=int, default=1)
    p.add_argument("--down-depth", type=int, default=2)
    p.add_argument("--text", action="store_true", help="Text output (default for CI/terminal)")
    p.add_argument("--png", action="store_true", help="Render PNG via Graphviz")
    p.add_argument("--out", default="graph_view", help="PNG output prefix")
    p.add_argument("--list-nodes", action="store_true", help="List all nodes and exit")
    args = p.parse_args()

    with open(args.pkl, "rb") as f:
        G = pickle.load(f)

    if args.list_nodes:
        for n, d in sorted(G.nodes(data=True), key=lambda x: (x[1].get("type",""), str(x[0]))):
            print(f"  {d.get('type','?'):12} {n}")
        return

    center = args.node
    if args.text or not args.png:
        print(render_text(G, center, args.edge_type, args.up_depth, args.down_depth))

    if args.png:
        out = render_png(G, center, args.edge_type, args.up_depth, args.down_depth, args.out)
        print(f"PNG -> {out}")


if __name__ == "__main__":
    main()
