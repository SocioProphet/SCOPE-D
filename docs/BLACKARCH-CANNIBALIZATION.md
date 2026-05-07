# BlackArch Cannibalization Plan

## Position

BlackArch is an upstream corpus to cannibalize, not a repository we modify for SocioProphet-specific behavior.

SCOPE-D should mine BlackArch for taxonomy, package metadata, category structure, defensive observables, safe validation ideas, and image/profile lessons. It must not turn BlackArch into a SocioProphet-maintained security distribution, and it must not import unsafe runtime offensive behavior into SCOPE-D.

## Source boundary

The BlackArch fork is treated as source material:

- package catalog
- category taxonomy
- PKGBUILD metadata
- package grouping conventions
- image/profile composition ideas
- upstream packaging discipline

The integration artifacts live in SCOPE-D, Ontogenesis, SocioSphere, Sherlock, SourceOS, and related policy/runtime repositories.

## Safety doctrine

Default posture:

- unknown tools are catalog-only
- offensive or abuse-prone tools are synthetic-fixture-only unless later explicitly approved
- defensive, code-audit, and forensic tools can become early lab-channel candidates
- hardware, RF, wireless, NFC, drone, automobile, Bluetooth, and physical-domain categories require explicit lab gates
- malware, backdoor, keylogger, anti-forensic, DoS, cracker, spoofing, packer, and credential-adjacent categories are blocked from runtime import by default

SCOPE-D may generate metadata, mappings, observables, detection expectations, and synthetic events from dangerous categories. It must not import payloads, C2 flows, stealth/evasion logic, unauthorized execution paths, destructive workflows, or credential-theft behavior.

## Cannibalization lanes

### 1. Category-to-capability mapping

Use BlackArch category groups as source input for SCOPE-D capability classes.

Examples:

| BlackArch category | SCOPE-D capability class | Default execution mode |
|---|---|---|
| blackarch-defensive | defensive_host_assessment | read_only_candidate |
| blackarch-code-audit | code_audit | read_only_candidate |
| blackarch-forensic | forensic_analysis | sandboxed_lab_candidate |
| blackarch-scanner | authorized_scanning | sandboxed_lab_required |
| blackarch-webapp | webapp_validation | sandboxed_lab_required |
| blackarch-fuzzer | fuzz_validation | sandboxed_lab_required |
| blackarch-wireless | wireless_lab | lab_gated |
| blackarch-radio | radio_lab | lab_gated |
| blackarch-nfc | nfc_lab | lab_gated |
| blackarch-drone | drone_security_lab | lab_gated |
| blackarch-automobile | vehicle_security_lab | lab_gated |
| blackarch-malware | malware_taxonomy | synthetic_only |
| blackarch-backdoor | backdoor_taxonomy | synthetic_only |
| blackarch-keylogger | credential_abuse_taxonomy | synthetic_only |
| blackarch-anti-forensic | anti_forensic_taxonomy | synthetic_only |
| blackarch-dos | denial_taxonomy | synthetic_only |

### 2. Package metadata extraction

Extract package metadata into a neutral import manifest:

- package name
- BlackArch categories
- upstream source URL where available
- version/pkgrel where available
- license where available
- dependencies
- package description
- runtime language/toolchain where inferable
- root/network/raw-socket/capture-device indicators
- target mutation indicators
- payload/credential/external-contact indicators

### 3. Risk classification

Classify each tool into one of:

- `allow_defensive`
- `lab_gated`
- `restricted_catalog_only`
- `blocked_runtime`
- `unknown_review_required`

Execution modes:

- `catalog_only`
- `synthetic_only`
- `read_only`
- `sandboxed_lab`
- `blocked`

### 4. SCOPE-D exercises

Generate safe SCOPE-D fixtures only after metadata classification exists.

Allowed early examples:

- code-audit fixture
- defensive host assessment fixture
- forensic synthetic-file fixture
- scanner synthetic-target fixture
- webapp synthetic-lab fixture

Forbidden in the first tranche:

- live exploit execution
- credential tests against real accounts
- stealth/evasion testing
- C2 behavior
- destructive tests
- external target interaction

### 5. SourceOS/SociOS lab channels

BlackArch-derived packages should not be installed into the base OS. They become candidates for signed lab channels:

- `sourceos-sec-core`
- `sourceos-sec-code-audit`
- `sourceos-sec-forensics`
- `sourceos-sec-web-lab`
- `sourceos-sec-network-lab`
- `sourceos-sec-fuzz-lab`
- `sourceos-sec-reverse-lab`
- `sourceos-sec-physical-lab`

Every channel must be reproducible, signed, SBOM-backed, policy-gated, and revocable.

### 6. Ontogenesis integration

Ontogenesis should own the durable ontology and validation constraints for:

- SecurityTool
- SecurityCapability
- DualUseCapability
- SafetyClass
- ExecutionMode
- ToolRisk
- EvidenceType
- DetectionControl
- PurpleTeamExercise
- AtomicValidation
- CountermeasureRule
- ThreatTechniqueMapping

### 7. SocioSphere and Sherlock integration

SocioSphere should display coverage, safety class, validation state, policy gates, SBOM status, and detection linkage.

Sherlock should index tool metadata, mappings, evidence, run receipts, and detection/control relationships.

## Definition of done for tranche 1

- BlackArch is not modified for SocioProphet behavior.
- SCOPE-D contains import/risk schemas.
- SCOPE-D contains this cannibalization doctrine.
- Dangerous categories default to `synthetic_only` or `blocked`.
- First fixtures are synthetic only.
- No package install path is added.
- No runtime offensive execution path is added.
