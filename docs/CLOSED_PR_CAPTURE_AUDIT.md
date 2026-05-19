# Closed PR Capture Audit

Status: v0.1  
Scope: closed but unmerged SCOPE-D pull requests reviewed for content loss  
Audit date: 2026-05-14

## Purpose

This audit prevents unmerged pull-request content from being silently lost.

Rule:

> Any closed/unmerged PR must be either explicitly superseded by merged work, or its still-relevant content must be replayed on a new branch and merged through review.

## Current closed/unmerged PR set

At the time of this audit, the closed/unmerged PR set contained:

- PR #6 — `ci: trigger Wargames validation workflow`
- PR #11 — `Add Wargames runtime layer architecture spec`

## PR #6 — CI trigger Wargames validation workflow

Status: closed as superseded.

Disposition: content captured by later merged CI work; no replay required.

Superseding work:

- PR #8 added explicit GitHub Actions CI workflow coverage.
- PR #10 added `workflow_dispatch` for manual validation reruns.
- Subsequent validation observation confirmed successful workflow runs on the relevant PR-head validation path.

Reason no replay is required:

- PR #6 was a documentation-only CI-trigger note.
- Its intended function was overtaken by real workflow infrastructure.
- No schema, validator, runtime, or contract semantics from PR #6 remain unique.

## PR #11 — Wargames runtime layer architecture spec

Status: closed unmerged.

Disposition: content replayed.

Important finding:

- PR #11 had zero commits and zero changed files.
- Its recoverable content existed only in the PR body.
- The PR body described a runtime-layer architecture specification for Devine Intelligence Wargames.

Replay artifact:

- `docs/WARGAMES_RUNTIME_LAYER_ARCHITECTURE.md`

Captured concepts:

- invocation envelope;
- contract resolver responsibilities;
- policy evaluator responsibilities;
- runtime decision classes: `allow`, `hard_block`, `soft_warn`, `audit_only`, `review_required`, `limit`;
- receipt emission requirements;
- capability-class gates for observe/profile, validate, export, enrich, activate/deliver, engage, graph view, and replay;
- failure-mode taxonomy;
- runtime evidence chain;
- recommended first implementation slices;
- no-runtime boundary and do-not-claim list.

Boundary:

The replayed artifact is architecture only. It adds no runtime code, agents, collectors, adapters, replay engine, graph traversal, client delivery, telemetry ingestion, engagement execution, or offensive workflow.

## Current result

- PR #6 is explicitly superseded.
- PR #11 content is replayed into a repository file.
- No known closed/unmerged PR content remains unaccounted for in the current audit set.

## Future audit rule

Before closing any future PR without merge:

1. Identify whether it contains unique files, comments, or design content.
2. If fully superseded, update the PR body or closing comment with the superseding PR(s).
3. If not fully superseded, replay the surviving content on a new branch.
4. Add or update this audit file when the closed PR contains design or implementation content worth preserving.
