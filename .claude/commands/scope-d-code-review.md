# SCOPE-D Code Security Review

Run a three-phase security audit of the target codebase, grounded in SCOPE-D's evidence spine and ATT&CK framework. Output findings formatted for direct ingestion into the SCOPE-D intelligence pipeline via `scripts/ingest-code-findings.js`.

## Context

This review runs inside the SCOPE-D purple-team platform. Every finding must:
- Carry a concrete `exploit_scenario` (attacker narrative, not an abstract description)
- Map to a MITRE ATT&CK technique ID
- Include a `confidence` score (0.0–1.0); findings below 0.7 will be dropped by the Arsenal confidence floor
- Survive hard-exclusion pre-filtering (DoS/rate-limiting/resource-leak/open-redirect/regex-injection/memory-safety-in-non-C/SSRF-in-HTML are filtered out as low-signal FPs)

## Usage

```
/scope-d:code-review [target-path-or-file]
```

If no path is given, review the files changed in the current working tree (`git diff --name-only HEAD`).

## Phase 1 — Threat Model

Map the attack surface before reading code. Identify:
- Entry points (HTTP handlers, CLI args, IPC channels, file parsers, deserialization)
- Trust boundaries (auth gates, process boundaries, privilege transitions)
- Data flows touching external input
- Dependencies with known CVE exposure

For each entry point, assert the most likely ATT&CK initial-access or execution technique.

## Phase 2 — Vulnerability Discovery

Audit each file for:
1. **Injection flaws** — SQL, command, template, LDAP (ATT&CK:T1190, T1059)
2. **Authentication & authorization** — missing checks, privilege escalation paths (ATT&CK:T1078)
3. **Secrets & credential exposure** — hardcoded keys, env leakage (ATT&CK:T1552)
4. **Insecure deserialization** — untrusted data parsed into objects (ATT&CK:T1190)
5. **Dependency vulnerabilities** — packages with known CVEs in the CISA KEV or EPSS > 0.7 (ATT&CK:T1195)
6. **Cryptographic weaknesses** — weak ciphers, broken key management (ATT&CK:T1600)
7. **Supply-chain risks** — pinned vs floating dependencies, CI/CD injection points (ATT&CK:T1195)

Skip findings that match the hard-exclusion families:
- Generic DoS / resource exhaustion
- Missing rate limiting
- Memory safety in non-C/C++ code
- Open redirect
- Regex injection
- SSRF in HTML files

## Phase 3 — Output (findings.json)

Return a single JSON array. Each element must conform to this shape:

```json
{
  "file": "path/to/file.ts",
  "line": 42,
  "severity": "HIGH",
  "category": "command_injection",
  "description": "Brief description of what the code does that is vulnerable.",
  "exploit_scenario": "An adversary with network access could send a crafted request to <endpoint>, causing the server to execute <command> with <process privileges>. The attack requires no authentication and produces no observable error to the client, making detection dependent on process-execution telemetry.",
  "recommendation": "Replace exec with execFile with a fixed command list; validate all arguments against a strict allowlist before passing to the shell.",
  "confidence": 0.85,
  "attack_technique": "ATT&CK:T1059"
}
```

Rules:
- `exploit_scenario` must commit to a **specific exploitation path** — no hedge phrases like "could potentially"
- `confidence` must be a float in [0.0, 1.0]; omit findings you cannot ground to a code location
- `severity` must be one of: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`
- `attack_technique` must be a valid ATT&CK technique ID (e.g. `ATT&CK:T1190`)
- If no findings survive the filter, return `[]` — do not invent low-confidence noise

## Feeding into the SCOPE-D pipeline

Save the output as `findings.json`, then:

```bash
# Ingest findings into intelligence enrichment format
node scripts/ingest-code-findings.js findings.json --out out/code-scan-enrichment.json

# Generate Arsenal detection candidates from the enrichment
node scripts/export-detection-candidates.js out/code-scan-enrichment.json --out out/detection-candidates.json
```

Detection candidates will require operator approval before any deployment (enforced by `DeliveryEnvelope` in CloudShell Fog).
