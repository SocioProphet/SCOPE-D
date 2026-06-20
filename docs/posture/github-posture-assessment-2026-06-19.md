# GitHub Posture Assessment — 2026-06-19

## Scope

Orgs assessed: `SocioProphet`, `socios-linux`, `sourceos-linux`  
Personal account: `mdheller` (2,031 following, 203 followers)

---

## Sanitization Findings

| Check | Result |
|---|---|
| mdheller following SG-flagged accounts | **0** — clean |
| SG-flagged accounts following mdheller | **2** — `Carrington-dev` (3,491★), `backrat13` (23★) |
| Forks from security-flagged upstream owners | **0** — clean |

Both flagged followers added to `intel/github/social_monitor.py` WATCHLIST for ongoing monitoring.

---

## Hardening Applied

### 1. Workflow Token Permissions — `read` (all orgs)

**Before:** `write` (default — allows workflows to push, create releases, modify repo state)  
**After:** `read`

```
SocioProphet   → read ✓
socios-linux   → read ✓
sourceos-linux → read ✓
```

Any workflow that needs write access must now explicitly declare `permissions:` in its YAML. This is the single most impactful control for preventing workflow-based lateral movement (T1546, T1059.006).

### 2. Action Restrictions — GitHub-owned + verified marketplace only (all orgs)

**Before:** `allowed_actions: all` (any action from any repo allowed)  
**After:** `github_owned_allowed: true, verified_allowed: true, patterns_allowed: []`

This closes the supply chain vector where a threat actor publishes a malicious GitHub Action and a developer adds it to a workflow. Non-verified third-party actions are now blocked org-wide.

### 3. Branch Protection — force-push and deletion blocked on main/master

**Before:** No branch protection on any repo  
**After:**

| Repo | Branch | Force-push | Deletion |
|---|---|---|---|
| SocioProphet/SCOPE-D | main | blocked ✓ | blocked ✓ |
| SocioProphet/socioprophet | master | blocked ✓ | blocked ✓ |
| sourceos-linux/sourceos-spec | main | blocked ✓ | blocked ✓ |
| sourceos-linux/sourceos-shell | main | blocked ✓ | blocked ✓ |
| sourceos-linux/sourceos-boot | main | blocked ✓ | blocked ✓ |
| sourceos-linux/openclaw | main | blocked ✓ | blocked ✓ |
| socios-linux/steveOS | master | blocked ✓ | blocked ✓ |
| socios-linux/Pengwin | master | blocked ✓ | blocked ✓ |
| socios-linux/Awesome-Linux-Software | master | blocked ✓ | blocked ✓ |

PR review not required (solo dev workflow). Rationale: force-push prevention protects against history rewrite attacks and accidental `git push --force` on main.

---

## Remaining Gaps

| Control | Status | Notes |
|---|---|---|
| Secret scanning push protection | **Not applied** | Requires GitHub Advanced Security (paid). Free plan: secret scanning available for public repos via org security settings. |
| CODEOWNERS | **Not applied** | No files yet. Priority: add to SCOPE-D for `detections/`, `ai-infra/`, `playbooks/` paths. |
| Dependency review | **Not applied** | Requires GitHub Actions `dependency-review-action` in PR workflow. Add to SCOPE-D CI. |
| Required PR reviews | **Intentionally skipped** | Solo dev workflow. Re-evaluate if team grows. |
| ANTHROPIC_API_KEY in CI | **Not applied** | Needed for `llm-eval.yml` (weekly promptfoo red-team). Add to SocioProphet/SCOPE-D secrets. |
| `socios-linux` main repos | **Partially applied** | Only 3 repos hardened — org has 10+ repos. Apply to remaining. |

---

## MITRE Coverage

| Control | MITRE TTPs mitigated |
|---|---|
| Workflow read-only token | T1546.004 (hook injection), T1059.006, T1552.001 |
| Action restrictions | T1195.001 (supply chain), T1554 |
| Branch protection | T1565 (data manipulation), T1070.004 (indicator removal) |

---

## Reassessment Command

```bash
# Verify workflow permissions
for org in SocioProphet socios-linux sourceos-linux; do
  echo "$org: $(gh api orgs/$org/actions/permissions/workflow --jq '.default_workflow_permissions')"
done

# Verify action restrictions
for org in SocioProphet socios-linux sourceos-linux; do
  gh api orgs/$org/actions/permissions/selected-actions --jq "\"$org: \" + (.github_owned_allowed|tostring) + \"/\" + (.verified_allowed|tostring)"
done

# Verify branch protection
gh api repos/SocioProphet/SCOPE-D/branches/main/protection --jq '{force_push: .allow_force_pushes.enabled, deletion: .allow_deletions.enabled}'
```
