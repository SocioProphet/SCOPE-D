# SCOPE-D Collector Policy

SCOPE-D collectors are evidence readers, not executors. This document defines the contract boundary that must exist before any collector is registered or invoked.

## Status

This is a pre-runtime doctrine and schema layer. It does not register live collectors, does not enable live AI/MCP fingerprinting, does not permit network calls, and does not authorize production or customer asset access.

The machine-readable contract is:

- `config/schemas/collector-policy.schema.json`

The positive fixture is:

- `examples/scope-d/collector-policy.example.json`

The fail-closed tests are:

- `scripts/test-collector-policy.js`

## Core rule

A collector must declare its capability boundary before it is trusted. If SCOPE-D cannot confirm the collector type, capabilities, read scope, execution guarantee, network boundary, and audit trail, the collector is blocked.

There is no degraded allow mode for unknown collectors.

## Required collector registration fields

Every collector policy must declare:

- `collectorId`
- `collectorType`
- `mode`
- `status`
- `owner`
- `engagementPolicyRequired: true`
- `safetyBoundaryRequired: true`

Unknown collector types are rejected by schema. Future collector types must be added to the enum deliberately and reviewed before use.

## Capability boundary

Allowed capabilities must be explicit. Current allowed capability atoms are limited to read-only or synthetic-fixture reads:

- `read_file_metadata`
- `read_file_content`
- `read_env_allowlist`
- `read_process_list`
- `read_manifest`
- `read_synthetic_fixture`

The following capabilities are prohibited:

- `write_file`
- `exec`
- `network_egress`
- `spawn_process`
- `delete_file`
- `modify_identity`
- `collect_credentials`
- `scan_public_network`
- `load_plugin`
- `mutate_policy`

Unknown capabilities are blocked by `unknownCapabilityPolicy: block`.

## Allowed read-only scopes

Read scopes must be enumerated. Wildcards are not valid authorization.

The schema rejects filesystem path entries such as:

- `*`
- `/`
- `~`
- `$HOME`
- `**`

Environment variables must also be allow-listed explicitly. A collector does not inherit authority from the parent process environment.

Process-list access, when permitted in the future, must retain:

- `includeArguments: false`
- `redactionRequired: true`

## Non-execution guarantee

Collectors are not executors. Every collector policy must declare:

- `executionGuarantee.level: none`
- `canExecuteCommands: false`
- `canSpawnProcesses: false`
- `canLoadPlugins: false`

Any collector policy that allows command execution, process spawning, or plugin loading is invalid.

## Network boundary

Collectors have no network authority by default. Every collector policy must declare:

- `egressMode: none`
- `publicScanningAllowed: false`
- `externalServicesAllowed: false`

Live network collection requires a separate future policy family and must not be introduced by relaxing this default collector contract.

## Fail-closed behavior

Collector policy must fail closed for:

- missing policy;
- invalid policy;
- unknown collector type;
- unknown capability;
- scope mismatch.

Each of these must evaluate to `block`.

## Audit trail

No silent reads are allowed. Every collector invocation must eventually produce or be linked to:

- a receipt;
- Event-IR evidence;
- artifact hashes;
- no-silent-read proof.

The current schema encodes this as:

- `receiptRequired: true`
- `eventIrRequired: true`
- `noSilentReads: true`
- `hashArtifacts: true`

## Invalid fixtures

The current test suite verifies hard rejection of:

- `fixtures/invalid/collector-policy-unknown-type.invalid.json`
- `fixtures/invalid/collector-policy-wildcard-path.invalid.json`
- `fixtures/invalid/collector-policy-execution-allowed.invalid.json`
- `fixtures/invalid/collector-policy-network-egress.invalid.json`

These are schema rejects, not warnings.

## Non-claims

This policy layer does not claim:

- live collector implementation;
- live MCP server fingerprinting;
- live AWS, GitHub, Kubernetes, host, or process collection;
- permission to execute commands;
- permission to scan public networks;
- permission to collect credentials;
- PolicyFabric runtime admission control.

Those surfaces require separate schemas, fixtures, tests, and fail-closed runners before implementation.
