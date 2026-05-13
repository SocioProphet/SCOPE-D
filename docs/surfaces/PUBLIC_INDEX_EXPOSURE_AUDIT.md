# Public Index Exposure Audit

Status: v0.1 canonical capture  
Canonical program: Devine Intelligence Wargames  
Surface family: Public search index, exposed assets, document leakage, defensive exposure queries  
Primary agents: Scout, Warden, Scribe, Veil, Herald, EvalAngelica, OFIF/Orion  
Implementation state: prose capture only; schema/example/CI backlog

## Purpose

This document captures public-index exposure auditing as a first-class defensive surface for Devine Intelligence Wargames.

In security practice, search dorks are crafted search queries that use advanced search operators to find indexed pages, files, paths, and metadata. In this program, they are treated strictly as **authorized exposure-audit queries** against owned, managed, or explicitly authorized domains and assets.

This surface exists to help defenders find their own accidentally exposed data, misconfigured paths, public documents, forgotten admin pages, exposed backups, stale artifacts, and policy violations.

It does not authorize reconnaissance, collection, access, probing, scraping, or exploitation of third-party systems.

## Scope rule

Public-index exposure audit is allowed only for:

- owned domains;
- managed domains;
- explicitly authorized customer domains;
- approved lab domains;
- approved staging domains;
- approved public asset inventories;
- approved brand or tenant watchlists;
- legally permitted public-index monitoring.

If scope is not explicit, the query is blocked.

## Non-goals

This surface must not be used to:

- access third-party systems without authorization;
- collect credentials;
- download sensitive third-party documents;
- bypass access controls;
- exploit discovered systems;
- run public scanning without approval;
- perform offensive reconnaissance;
- automate harmful collection;
- publish raw sensitive results.

## Defensive query model

A defensive exposure query should be represented as a governed object.

```yaml
kind: PublicIndexExposureQuery
queryId: string
scope:
  tenant: string
  domains: []
  assetRefs: []
  authorizationRef: string
query:
  engine: google | bing | github | other
  expression: string
  operators: []
intent: exposure_audit | document_hygiene | admin_surface_review | backup_review | brand_monitoring | repo_hygiene
riskClass: low | medium | high
prohibitedCollection: true
redactionRequired: true
createdBy: string
approvedBy: []
expiresAt: string
```

## Common authorized query classes

### Domain-restricted file exposure

Purpose: identify sensitive files indexed under an owned domain.

Examples of query intent:

- public PDFs with sensitive labels;
- spreadsheets;
- SQL dumps;
- backup archives;
- configuration-like filenames.

### Admin and login surface review

Purpose: identify publicly indexed admin or login surfaces under owned domains.

Examples of query intent:

- forgotten admin paths;
- legacy panels;
- staging login pages;
- unadvertised dashboard endpoints.

### Directory listing review

Purpose: detect exposed directory listings or backup directories under owned domains.

Examples of query intent:

- indexed backup folders;
- public file indexes;
- old static site exports;
- build artifacts.

### Repository hygiene

Purpose: identify public repository artifacts under owned organizations.

Examples of query intent:

- accidentally committed secrets indicators;
- stale config files;
- exposed CI artifacts;
- public package metadata drift.

### Brand and tenant monitoring

Purpose: identify public-index references to a tenant, brand, system, or project.

Examples of query intent:

- public mentions of internal project names;
- leaked document titles;
- unsupported mirror sites;
- stale public references.

## Safe output model

A query should emit findings, not raw collection dumps.

```yaml
kind: PublicIndexExposureFinding
findingId: string
queryRef: string
discoveredAt: string
scopeRef: string
assetRef: string
urlDigest: string
urlRedacted: string
findingType: sensitive_document | exposed_admin_surface | exposed_backup | repo_hygiene | directory_listing | brand_exposure | unknown
severity: info | low | medium | high | critical
confidence: number
evidenceSummary: string
rawSensitiveContentStored: false
redactionState: redacted | withheld
recommendedAction: string
proofRefs: []
ownerRefs: []
status: open | triaged | remediated | accepted_risk | false_positive
```

Raw sensitive content should not be stored by default. Use digests, redacted URLs, minimal snippets, and owner/action metadata.

## Boundary Hypergraph mapping

Public-index exposure findings map into the Boundary Cyber Hypergraph.

Relevant boundary concepts:

- `Component`: public website, repository, document store, static bucket, docs portal;
- `Port`: public HTTP, public repo, public document index;
- `Contract`: expected public access policy;
- `BoundaryEvent`: `public_index_observed`, `document_exposed`, `admin_surface_indexed`, `backup_indexed`;
- `Evidence`: query result digest, redacted search result, cached metadata digest;
- `Finding`: exposure finding;
- `Artifact`: document, config, backup, page, repo file.

Negative evidence examples:

- expected removal record missing after takedown;
- expected owner acknowledgement missing;
- expected robots/noindex policy missing;
- expected access-control correction missing after remediation window.

## DEFENSE mode

In DEFENSE mode, public-index exposure audit supports:

- owned-domain exposure detection;
- repository hygiene;
- document hygiene;
- public surface inventory;
- remediation tasking;
- OFIF client-facing exposure summaries;
- proof-backed assurance.

DEFENSE mode may correlate exposure findings with internal asset inventory when authorized.

## LEARNING mode

In LEARNING mode, public-index exposure audit supports:

- teaching search-index risk;
- building redacted examples;
- improving query taxonomy;
- learning which public artifacts create risk;
- training defenders to distinguish exposure from access.

LEARNING outputs must be synthetic, redacted, or authorized.

## Dynamic engagement relation

Exposure findings may trigger engagement levels:

- E0: observe indexed exposure;
- E1: alert and preserve digest;
- E2: contain owned asset or remove public artifact;
- E3: adjust public access policy, headers, repository settings, or docs pipeline;
- E5: submit provider or search-index removal request where authorized.

E4/E5/E6 rules remain governed by `WARGAMES_DYNAMIC_ENGAGEMENT_POLICY.md`.

Until delegated policy exists, Michael Heller signoff is required for elevated or external coordination that falls under E4/E5/E6 or sensitive release.

## OFIF / Orion exposure

OFIF may expose client-facing summaries such as:

- public exposure summary;
- affected asset list with redacted URLs;
- severity distribution;
- remediation plan;
- proof-backed assurance packet;
- trend over time.

OFIF should not expose raw sensitive content.

## Ontogenesis / ATT&CK relation

Ontogenesis may model exposure concepts such as:

- `PublicIndexExposureQuery`;
- `PublicIndexExposureFinding`;
- `SensitiveDocumentExposure`;
- `ExposedAdminSurface`;
- `ExposedBackup`;
- `RepositoryHygieneFinding`;
- `RemediationRequest`.

ATT&CK mappings, where used, should describe defensive coverage or exposure patterns, not operational procedures.

## SynapseIQ relation

SynapseIQ can enrich public-index exposure records with:

- business glossary terms;
- asset ownership;
- sensitivity labels;
- confidence scoring;
- remediation priority;
- duplicate clustering;
- trend summaries;
- OFIF activation readiness.

## Scout role

Scout may run authorized exposure queries and emit findings.

Scout must:

- verify scope;
- store minimal evidence;
- redact raw results;
- attach query refs;
- emit proof refs;
- avoid third-party collection.

## Warden role

Warden gates:

- scope authorization;
- allowed query operators;
- result handling;
- remediation action;
- escalation;
- external coordination.

## Scribe role

Scribe records:

- query authorization;
- query expression digest;
- finding digest;
- remediation proof;
- takedown/removal request proof;
- closure receipt.

## Veil role

Veil enforces:

- redaction;
- no raw sensitive-content persistence;
- no public release of sensitive results;
- disclosure class;
- tenant boundary;
- retention limits.

## Example safe query intents

Do not store raw dork strings as executable offensive recipes without scope. Store them as authorized intent objects.

Safe intent examples:

- owned domain PDF sensitivity review;
- owned domain admin-surface review;
- owned organization repo hygiene review;
- owned docs portal stale artifact review;
- authorized customer public backup exposure review.

## Required follow-ups

Schemas:

- `public-index-exposure-query.schema.json`;
- `public-index-exposure-finding.schema.json`;
- `public-index-remediation-task.schema.json`;
- `public-index-removal-request.schema.json`.

Examples:

- owned-domain exposure query;
- authorized customer-domain exposure query;
- redacted exposure finding;
- false-positive finding;
- remediation closure receipt;
- OFIF public exposure summary.

CI checks:

- every query requires authorization scope;
- every finding requires redaction state;
- raw sensitive content storage must be false by default;
- third-party domains without authorization must fail validation;
- client-facing outputs require disclosure class;
- external coordination requires approval path.

## Completion definition

Public-index exposure audit is implementation-backed only when schemas, examples, validation, redaction checks, and authorization checks exist.

Until then, this document is canonical prose capture, not runtime implementation.
