# SCOPE-D Codebase Graph

Static-analysis codebase graph builder and visualizer for SCOPE-D's graph-robustness lane.

Produces a directed multi-edge-type graph from source code that feeds:
- Graph robustness assessment (attack surface, coupling density, critical paths)
- HellGraph proof-stream replay
- MeshRush graph view export
- SynapseIQ/Tree-sitter enrichment (future — see `docs/WARGAMES_TREE_SITTER_LSA_BRIDGE.md`)

## Tools

| Script | Purpose |
|---|---|
| `build_codebase_graph.py` | Build graph from source tree → `.pkl`, `.graphml`, `.assessment.json` |
| `visualize_codebase_graph.py` | Query and render graph neighborhoods (text or PNG) |
| `export_hellgraph.py` | Export to GEXF / GraphML / JSONL proof stream for HellGraph + MeshRush |

## Graph schema

Four node types, four edge types — same schema as `GraphRobustnessAssessment.graphType=dependency_graph`:

```
Nodes: directory  file  class  function
Edges: contains   imports  invokes  inherits
```

## Quick start

```bash
pip install networkx

# Build graph from a local repo
python graph-robustness/codebase/build_codebase_graph.py ~/dev/MyRepo \
    --out /tmp/mygraph \
    --source-ref https://github.com/SocioProphet/MyRepo

# List all nodes
python graph-robustness/codebase/visualize_codebase_graph.py \
    --pkl /tmp/mygraph.pkl --list-nodes

# Show what a file imports (text)
python graph-robustness/codebase/visualize_codebase_graph.py \
    --pkl /tmp/mygraph.pkl \
    --node src/core/agent.py \
    --edge-type imports --up-depth 2 --down-depth 2 --text

# Export to HellGraph + MeshRush
python graph-robustness/codebase/export_hellgraph.py /tmp/mygraph.pkl \
    --out /tmp/mygraph --all
```

## Architecture and SynapseIQ upgrade path

Current backend: Python `ast` module — zero-execution, no imports, Python only.

`build_codebase_graph.py` is designed so the parser backend is a drop-in:
the graph schema (node/edge types) is language-agnostic. When
`SOURCEOS_SYNAPSEIQ_URL` is set, future versions will delegate parse-tree
extraction to SynapseIQ (Tree-sitter grammars) for multi-language support:
Rust, Go, C, TypeScript, and any language with a SynapseIQ grammar.

See `docs/WARGAMES_TREE_SITTER_LSA_BRIDGE.md` for the planned bridge from
Tree-sitter parse trees to LSA/LSI topic enrichment and MeshRush graph views.

## Threat intelligence origin

The codebase graph approach was independently validated by studying
`standardgalactic/SeeRepo` (Apache-2.0), which implements the same
`contains/imports/invokes/inherits` schema for AI-agent bug-finding. SeeRepo
demonstrates that static AST graphs are effective for code intelligence without
execution. SCOPE-D's implementation is an independent derivation adapted for
the SCOPE-D control loop, collector policy, and HellGraph/MeshRush integration.
See `docs/threat-actors/STANDARDGALACTIC.md` for full threat actor analysis.

## Collector policy

- Execution mode: `static_analysis_only`
- Network egress: none
- Credential access: none
- Scope: authorized local working copies and CI-checked-out repositories
- Mutability: read-only (no writes to target repository)
