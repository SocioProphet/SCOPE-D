# SCOPE-D Scan Assurance Product Demo

Status: product-facing synthetic demo  
Runtime posture: local/passive by default  
Audience: operator, reviewer, customer-facing assurance workflow  

## Goal

This demo proves the end-to-end SCOPE-D product path:

1. run a governed scan assurance workflow;
2. generate a hash-bound run manifest;
3. export a client evidence package;
4. apply a client-safe redaction profile;
5. produce a redacted evidence package for delivery.

The default demo does not contact any live target and does not perform credential access, payload delivery, mutation, or destructive behavior.

## One-command demo

```bash
node scripts/scope-d.js demo:scan --out-dir runs/demo-scope-d
```

Expected output includes JSON with:

- `status: complete`
- `assuranceRunRef`
- `runManifestRef`
- `clientEvidencePackageRef`
- `redactedEvidencePackageRef`

## Generated product artifacts

The demo writes:

- `run/operator-scan-assurance-run.json`
- `run/operator-run-manifest.json`
- `client-evidence-package/client-evidence-package.json`
- `client-evidence-package/client-evidence-package.md`
- `redacted-client-evidence-package/redacted-evidence-package.json`
- `redacted-client-evidence-package/redacted-evidence-package.md`
- redacted evidence artifacts under `redacted-client-evidence-package/artifacts/`

## Boundary

Default mode is `local_passive`.

The default demo does not perform:

- live target action;
- network access;
- credential access;
- payload delivery;
- mutation;
- destructive behavior.

Live-readonly mode is available through the underlying scan assurance runner, but it remains gated by capability decision, execution policy, egress audit directory, and `SCOPE_D_ENABLE_LIVE_READONLY=1`.

## Operator value

This is the minimal product loop:

- evidence in;
- governed assessment;
- operator workflow;
- dashboard/report artifacts;
- hash-bound manifest;
- client evidence package;
- redacted delivery package.

The demo is synthetic, but the flow is the product.