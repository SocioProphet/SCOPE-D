# BlackArch Read-Only Miner

## Purpose

The BlackArch read-only miner converts a local BlackArch-style package archive into SCOPE-D catalog metadata.

It is a cannibalization tool, not an execution tool. It mines package metadata, category mappings, provenance, dependency hints, safety posture, and evidence expectations so SCOPE-D can reason about security capability without importing upstream runtime behavior.

## Hard boundary

The miner must not:

- install packages;
- build packages;
- run packages;
- invoke `makepkg`;
- invoke `pacman`;
- call shell scripts from the upstream archive;
- contact external services;
- scan live targets;
- inspect production hosts;
- authorize runtime execution.

The miner reads local files only.

## Inputs

Expected input is a local checkout of a BlackArch-style repository containing:

```text
lists/groups
packages/*/PKGBUILD
aur/*/PKGBUILD          optional
```

The BlackArch fork remains source material. Do not write SocioProphet-specific integration state into the fork.

## Outputs

The miner emits one JSON catalog file:

```text
blackarch-security-tools.json
```

The file uses the top-level catalog shape described by:

```text
config/schemas/blackarch-catalog.schema.json
```

Each generated record follows:

```text
config/schemas/security-tool.schema.json
```

## Safe local usage

From a SCOPE-D checkout:

```bash
python3 tools/blackarch_readonly_miner.py /path/to/blackarch --out artifacts/blackarch-security-tools.json
python3 tools/validate_blackarch_catalog.py artifacts/blackarch-security-tools.json
```

For smoke testing:

```bash
python3 tools/blackarch_readonly_miner.py /path/to/blackarch --limit 25 --out artifacts/blackarch-smoke.json
python3 tools/validate_blackarch_catalog.py artifacts/blackarch-smoke.json
```

## Safety model

The miner emits metadata with these execution modes:

- `catalog_only`
- `synthetic_only`
- `read_only`
- `sandboxed_lab`
- `blocked`

These modes are descriptive classifications for future policy decisions. They do not grant execution authority.

Every record must keep:

```json
{
  "execution": {
    "wrapperRequired": true,
    "productionAllowed": false
  }
}
```

A generated catalog is never a runtime allow-list.

## Classification policy

The default posture is conservative:

- unknown categories become `unknown_review_required` and `catalog_only`;
- restricted categories become `restricted_catalog_only` and `synthetic_only`;
- physical-domain categories become `lab_gated` and require hardware/physical-domain gates;
- defensive/code-audit/IDS/threat-model categories can become `allow_defensive` candidates;
- scanner, webapp, networking, packet, fuzzing, and reverse-engineering categories remain lab-gated.

Package-level classification may be stricter than category-level classification.

## Validation policy

Run the validator after every miner run:

```bash
python3 tools/validate_blackarch_catalog.py artifacts/blackarch-security-tools.json
```

The validator fails if:

- `recordCount` does not match the number of records;
- a record is missing provenance, safety, execution, or evidence metadata;
- production execution is allowed;
- a wrapper is not required;
- restricted or unknown classes default to runtime-capable modes;
- raw output is allowed in generated catalog records.

Warnings are not success criteria. Treat warnings as review input.

## Downstream consumers

Generated catalogs may feed:

- SCOPE-D synthetic exercises;
- Ontogenesis security-tool ontology;
- SocioSphere posture and coverage dashboards;
- Sherlock searchable security capability graph;
- SourceOS lab-channel planning.

Generated catalogs must not directly feed:

- package installation;
- live target execution;
- production policy exceptions;
- automatic agent tool use;
- external scanning.

## Definition of done for this lane

A BlackArch cannibalization tranche is valid only when:

- the BlackArch fork remains unmodified;
- the miner output validates;
- generated records are metadata-only;
- all records keep `productionAllowed: false`;
- all records keep `wrapperRequired: true`;
- restricted categories are synthetic/catalog only;
- no runtime package execution is introduced.
