# SCOPE-D Detection and Countermeasure Packaging

SCOPE-D packages generated and imported detections as governed countermeasures. This directory is for detection-as-code, policy-as-code, and defensive rule artifacts that are traceable to evidence and safe validation tests.

## Rule families

Supported target families:

- Sigma
- SPL
- YARA
- Snort / Suricata
- ClamAV
- OSQuery
- OPA / Rego
- Kubernetes policy
- GitHub repository policy
- AWS SCP / IAM policy
- SourceOS policy

## Maturity states

Every rule must declare a maturity state:

- `production`: expected to perform with minimal tuning;
- `supplemental`: useful but environment-specific;
- `hunt_only`: intended for analyst-led hunts, not production alerting;
- `experimental`: under validation;
- `deprecated`: retained only for historical mapping.

## Required metadata

Every countermeasure artifact should include:

- stable ID;
- rule type;
- maturity state;
- severity;
- source finding references;
- ATT&CK / ATLAS mappings where relevant;
- expected telemetry;
- false-positive risk;
- validation test references;
- deployment gate;
- rollback plan;
- owner;
- review timestamp.

## Safety doctrine

Generated controls are recommendations until approved through a policy gate. SCOPE-D may generate SCPs, IAM policies, detections, or OPA policies, but it must not deploy them without explicit operator and policy approval.
