# SVF Defensive Assurance Plan

Status: contract declaration for downstream workspace discovery  
Plane: SCOPE-D / defensive assurance  
Upstream authority: SocioProphet/ProCybernetica SVF policy primitive  
Workspace registry: SocioProphet/sociosphere SVF workspace registry

## Purpose

This document defines SCOPE-D's first Sovereign Validation Fabric (SVF) defensive-assurance plan contract. It wraps existing SCOPE-D safe validation lanes as declared SVF Actions and one advisory Plan.

This is not a new runtime. It does not grant new execution authority. It does not add live collectors, live target operations, credential handling, payload behavior, production mutation, or external-environment behavior.

## Current basis

SCOPE-D already exposes a contract-first defensive substrate:

- engagement-policy schema and fail-closed tests;
- collector-policy schema and fail-closed tests;
- synthetic event generation;
- synthetic control-loop run initialization;
- AI-infra synthetic vertical slice;
- graph-robustness synthetic vertical slice;
- run verification and reporting;
- dashboard export and Ontogenesis export;
- LSA map reporting;
- tamper-detection smoke tests.

SVF does not replace these lanes. It registers them as governed validation capabilities that Sociosphere can discover and select.

## SVF ids

The first SCOPE-D SVF contract uses these ids:

- `svf:policy:scope-d.synthetic-readonly`
- `svf:action:scope-d.npm-test`
- `svf:action:scope-d.engagement-policy`
- `svf:action:scope-d.collector-policy`
- `svf:action:scope-d.ai-infra`
- `svf:action:scope-d.graph-robustness`
- `svf:action:scope-d.reporting`
- `svf:action:scope-d.tamper`
- `svf:plan:scope-d.defensive-assurance-basic`

## Claim scope

The first plan may only support these bounded claims:

- `schema_conformant`
- `fixtures_validated`
- `policy_boundary_preserved`
- `non_production_only`

It does not certify:

- live-target safety;
- production readiness;
- runtime collector behavior;
- external-environment behavior;
- operator authorization outside committed synthetic fixtures;
- offensive capability;
- artifact digest integrity beyond the existing SCOPE-D validation lanes.

## Capability policy

`svf:policy:scope-d.synthetic-readonly` is advisory and read-only. It admits CI/workspace invocation of existing SCOPE-D validation commands only. It does not admit production-environment validation.

The policy permits local execution of declared validation commands as repo-local checks. Any future Action that requires network access, credential access, target mutation, or external-environment interaction requires a separate policy profile and a separate review.

## Plan composition

`svf:plan:scope-d.defensive-assurance-basic` composes the existing safe validation lanes:

1. `npm test`
2. `npm run test:engagement-policy`
3. `npm run test:collector-policy`
4. `npm run test:ai-infra`
5. `npm run test:graph-robustness`
6. `npm run test:reporting`
7. `npm run test:tamper`

The first contract is advisory in the Sociosphere registry. It becomes a blocking candidate only after the repo-local SVF validator is observed green and Sociosphere updates the registry posture.

## Non-claims

This document is a plan contract. It does not prove that the plan has run.

This document does not issue a ValidationReceipt.

This document does not authorize any SCOPE-D runtime beyond existing test and validation commands.

This document does not change the repository safety doctrine: SCOPE-D defaults to read-only collection, synthetic validation, and dry-run execution.
