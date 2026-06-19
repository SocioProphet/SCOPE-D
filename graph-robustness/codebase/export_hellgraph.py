#!/usr/bin/env python3
"""SCOPE-D Codebase Graph -> HellGraph / MeshRush Exporter.

Converts a codebase .pkl graph (build_codebase_graph.py output) into the
SCOPE-D wargames graph export formats:
  - GEXF   (Gephi / Sigma.js / direct HellGraph ingest)
  - GraphML (MeshRush graph view export)
  - JSONL  (streaming edge list for HellGraph proof-stream replay)

All node and edge attributes are preserved. Graph is annotated with
SCOPE-D metadata for provenance tracing through the control loop.

Defensive use only. No network egress. No execution of target code.
"""
from __future__ import annotations

import argparse
import datetime
import json
import pickle
import sys
import uuid
from pathlib import Path

try:
    import networkx as nx
except ImportError:
    sys.exit("networkx required: pip install networkx")

SCOPE_D_VERSION = "0.1.0"


def _annotate(G: nx.DiGraph, source_ref: str, run_id: str) -> nx.DiGraph:
    H = G.copy()
    H.graph.update({
        "scope_d_version": SCOPE_D_VERSION,
        "graph_class": "codebase_dependency",
        "source_ref": source_ref,
        "run_id": run_id,
        "exported_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "hellgraph_stream_id": f"codebase-{run_id}",
        "meshrush_view_id": f"codebase-view-{run_id}",
    })
    return H


def _to_str_attrs(G: nx.DiGraph) -> nx.DiGraph:
    H = nx.DiGraph(**{k: str(v) for k, v in G.graph.items()})
    for n, d in G.nodes(data=True):
        H.add_node(str(n), **{k: str(v) for k, v in d.items() if not k.startswith("_")})
    for u, v, d in G.edges(data=True):
        H.add_edge(str(u), str(v), **{k: str(v2) for k, v2 in d.items()})
    return H


def export_gexf(G: nx.DiGraph, path: str):
    H = _to_str_attrs(G)
    nx.write_gexf(H, path)
    print(f"[scope-d] GEXF -> {path}  (HellGraph ingest ready)")


def export_graphml(G: nx.DiGraph, path: str):
    H = _to_str_attrs(G)
    nx.write_graphml(H, path)
    print(f"[scope-d] GraphML -> {path}  (MeshRush view export ready)")


def export_edge_jsonl(G: nx.DiGraph, path: str, run_id: str):
    """Streaming edge list for HellGraph proof-stream replay."""
    ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with open(path, "w") as f:
        # header event
        f.write(json.dumps({
            "event": "graph_open",
            "run_id": run_id,
            "graph_class": "codebase_dependency",
            "node_count": G.number_of_nodes(),
            "edge_count": G.number_of_edges(),
            "ts": ts,
            "schema": "wargames-hellgraph-proof-stream",
        }) + "\n")
        # node events
        for n, d in G.nodes(data=True):
            f.write(json.dumps({
                "event": "node",
                "id": str(n),
                "node_type": d.get("type", "unknown"),
                "name": d.get("name", str(n)),
                "file": d.get("file", ""),
                "run_id": run_id,
                "ts": ts,
            }) + "\n")
        # edge events
        for u, v, d in G.edges(data=True):
            f.write(json.dumps({
                "event": "edge",
                "src": str(u),
                "dst": str(v),
                "edge_type": d.get("type", "unknown"),
                "run_id": run_id,
                "ts": ts,
            }) + "\n")
        # close event
        f.write(json.dumps({"event": "graph_close", "run_id": run_id, "ts": ts}) + "\n")
    print(f"[scope-d] HellGraph JSONL proof stream -> {path}")


def main():
    p = argparse.ArgumentParser(description="SCOPE-D codebase graph HellGraph/MeshRush exporter")
    p.add_argument("pkl", help="Path to codebase_graph.pkl")
    p.add_argument("--out", default="codebase_graph", help="Output prefix")
    p.add_argument("--source-ref", default="", help="Git URL or identifier")
    p.add_argument("--run-id", default="", help="SCOPE-D run ID (auto-generated if omitted)")
    p.add_argument("--gexf", action="store_true", help="Export GEXF (HellGraph)")
    p.add_argument("--graphml", action="store_true", help="Export GraphML (MeshRush)")
    p.add_argument("--jsonl", action="store_true", help="Export JSONL proof stream (HellGraph replay)")
    p.add_argument("--all", action="store_true", help="Export all formats")
    args = p.parse_args()

    run_id = args.run_id or f"codebase-{uuid.uuid4().hex[:8]}"

    with open(args.pkl, "rb") as f:
        G = pickle.load(f)

    G = _annotate(G, args.source_ref or args.pkl, run_id)
    print(f"[scope-d] Loaded graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges  run_id={run_id}")

    do_gexf    = args.gexf    or args.all
    do_graphml = args.graphml or args.all
    do_jsonl   = args.jsonl   or args.all

    if not (do_gexf or do_graphml or do_jsonl):
        do_gexf = do_graphml = do_jsonl = True  # default: all

    if do_gexf:    export_gexf(G, args.out + ".gexf")
    if do_graphml: export_graphml(G, args.out + ".graphml")
    if do_jsonl:   export_edge_jsonl(G, args.out + ".hellgraph.jsonl", run_id)


if __name__ == "__main__":
    main()
