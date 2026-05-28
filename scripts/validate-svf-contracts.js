#!/usr/bin/env node
/* Validate SCOPE-D Sovereign Validation Fabric contract declarations.
 *
 * This validator checks repo-local SVF contract shape and safety posture. It
 * does not execute the declared actions and does not issue receipts.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTRACT_PATH = path.join(ROOT, 'svf', 'scope-d-defensive-assurance-basic.json');
const PACKAGE_PATH = path.join(ROOT, 'package.json');

const EXPECTED_POLICY_ID = 'svf:policy:scope-d.synthetic-readonly';
const EXPECTED_PLAN_ID = 'svf:plan:scope-d.defensive-assurance-basic';
const EXPECTED_PROFILE_REF = 'svf:profile:scope-d.defensive-assurance';
const ALLOWED_CLAIMS = new Set([
  'schema_conformant',
  'fixtures_validated',
  'policy_boundary_preserved',
  'non_production_only'
]);
const REQUIRED_ACTIONS = new Set([
  'svf:action:scope-d.npm-test',
  'svf:action:scope-d.engagement-policy',
  'svf:action:scope-d.collector-policy',
  'svf:action:scope-d.ai-infra',
  'svf:action:scope-d.graph-robustness',
  'svf:action:scope-d.reporting',
  'svf:action:scope-d.tamper'
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function result(checkId, passed, diagnostics = []) {
  return { check_id: checkId, passed, diagnostics };
}

function includesAll(actual, expectedSet) {
  const actualSet = new Set(actual || []);
  return [...expectedSet].filter((item) => !actualSet.has(item));
}

function validate() {
  const contract = readJson(CONTRACT_PATH);
  const pkg = readJson(PACKAGE_PATH);
  const scripts = pkg.scripts || {};
  const results = [];

  results.push(result('contract-id', contract.contract_id === 'svf:contract:scope-d.defensive-assurance-basic', [contract.contract_id]));
  results.push(result('profile-ref', contract.upstream_authority && contract.upstream_authority.profile_ref === EXPECTED_PROFILE_REF, [contract.upstream_authority && contract.upstream_authority.profile_ref]));

  const policy = contract.capability_policy || {};
  results.push(result('policy-id', policy.policy_id === EXPECTED_POLICY_ID, [policy.policy_id]));
  results.push(result('policy-production-disallowed', policy.production_environment_allowed === false));
  results.push(result('policy-human-approval-not-required-for-synthetic-readonly', policy.human_approval_required === false));
  results.push(result('policy-network-none', Array.isArray(policy.network_modes) && policy.network_modes.length === 1 && policy.network_modes[0] === 'network_none', policy.network_modes || []));
  results.push(result('policy-credential-none', Array.isArray(policy.credential_modes) && policy.credential_modes.length === 1 && policy.credential_modes[0] === 'credential_none', policy.credential_modes || []));
  results.push(result('policy-non-claims-present', Array.isArray(policy.non_claims) && policy.non_claims.length >= 3));

  const actions = contract.actions || [];
  const actionIds = actions.map((action) => action.action_id);
  const missingActions = includesAll(actionIds, REQUIRED_ACTIONS);
  results.push(result('required-actions-present', missingActions.length === 0, missingActions));
  results.push(result('action-ids-unique', actionIds.length === new Set(actionIds).size));

  for (const action of actions) {
    const checkPrefix = `action:${action.action_id}`;
    const binding = action.binding || {};
    const capability = action.capability || {};
    const claims = action.claim_scopes || [];
    const badClaims = claims.filter((claim) => !ALLOWED_CLAIMS.has(claim));

    results.push(result(`${checkPrefix}:binding-kind-npm-script`, binding.kind === 'npm_script', [binding.kind]));
    results.push(result(`${checkPrefix}:script-exists`, typeof binding.entrypoint === 'string' && Boolean(scripts[binding.entrypoint]), [binding.entrypoint]));
    results.push(result(`${checkPrefix}:network-none`, capability.network_mode === 'network_none', [capability.network_mode]));
    results.push(result(`${checkPrefix}:credential-none`, capability.credential_mode === 'credential_none', [capability.credential_mode]));
    results.push(result(`${checkPrefix}:backend-local`, capability.backend === 'local', [capability.backend]));
    results.push(result(`${checkPrefix}:claims-allowed`, badClaims.length === 0, badClaims));
    results.push(result(`${checkPrefix}:non-claims-present`, Array.isArray(action.non_claims) && action.non_claims.length >= 1));
  }

  const plan = contract.plan || {};
  const planActions = plan.actions || [];
  const planActionRefs = planActions.map((step) => step.action_ref);
  const missingPlanRefs = planActionRefs.filter((actionRef) => !actionIds.includes(actionRef));
  const missingRequiredPlanRefs = includesAll(planActionRefs, REQUIRED_ACTIONS);
  const planBadClaims = (plan.claim_scopes || []).filter((claim) => !ALLOWED_CLAIMS.has(claim));

  results.push(result('plan-id', plan.plan_id === EXPECTED_PLAN_ID, [plan.plan_id]));
  results.push(result('plan-mode-advisory', plan.mode === 'advisory', [plan.mode]));
  results.push(result('plan-policy-ref', plan.policy_ref === EXPECTED_POLICY_ID, [plan.policy_ref]));
  results.push(result('plan-action-refs-resolve', missingPlanRefs.length === 0, missingPlanRefs));
  results.push(result('plan-includes-required-actions', missingRequiredPlanRefs.length === 0, missingRequiredPlanRefs));
  results.push(result('plan-claims-allowed', planBadClaims.length === 0, planBadClaims));
  results.push(result('plan-non-claims-present', Array.isArray(plan.non_claims) && plan.non_claims.length >= 3));

  const passed = results.every((item) => item.passed);
  return {
    validator: 'scope-d.svf-contracts.validator.v1',
    passed,
    action_count: actions.length,
    result_count: results.length,
    results
  };
}

const validation = validate();
console.log(JSON.stringify(validation, null, 2));
if (!validation.passed) {
  console.error('FAIL: SCOPE-D SVF contracts');
  process.exit(1);
}
console.log('PASS: SCOPE-D SVF contracts');
