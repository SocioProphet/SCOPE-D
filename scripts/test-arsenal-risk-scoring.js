#!/usr/bin/env node
'use strict';

/**
 * test-arsenal-risk-scoring.js
 * Tests for arsenal-risk-scoring.js and arsenal-owasp-asi.js.
 */

const { computeRiskScore, severityToScore, scoreToSeverity, SEVERITY_WEIGHTS } =
  require('./arsenal-risk-scoring');
const { OWASP_ASI, mapCategoryToASI, mapASIToAttackTechnique } =
  require('./arsenal-owasp-asi');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    passed += 1;
  } else {
    console.error(`FAIL: ${label}`);
    failed += 1;
  }
}

// --- SEVERITY_WEIGHTS ---
assert('SEVERITY_WEIGHTS.critical === 1.0', SEVERITY_WEIGHTS.critical === 1.0);
assert('SEVERITY_WEIGHTS.high === 0.75',    SEVERITY_WEIGHTS.high === 0.75);
assert('SEVERITY_WEIGHTS.medium === 0.45',  SEVERITY_WEIGHTS.medium === 0.45);
assert('SEVERITY_WEIGHTS.low === 0.2',      SEVERITY_WEIGHTS.low === 0.2);
assert('SEVERITY_WEIGHTS.info === 0.05',    SEVERITY_WEIGHTS.info === 0.05);

// --- severityToScore ---
assert("severityToScore('critical') === 1.0",      severityToScore('critical') === 1.0);
assert("severityToScore('high') === 0.75",         severityToScore('high') === 0.75);
assert("severityToScore('medium') === 0.45",       severityToScore('medium') === 0.45);
assert("severityToScore('low') === 0.2",           severityToScore('low') === 0.2);
assert("severityToScore('info') === 0.05",         severityToScore('info') === 0.05);
assert("severityToScore('informational') === 0.05",severityToScore('informational') === 0.05);
assert("severityToScore('unknown') === 0",         severityToScore('unknown') === 0);

// --- scoreToSeverity ---
assert("scoreToSeverity(0.9) === 'critical'",  scoreToSeverity(0.9) === 'critical');
assert("scoreToSeverity(0.85) === 'critical'", scoreToSeverity(0.85) === 'critical');
assert("scoreToSeverity(0.7) === 'high'",      scoreToSeverity(0.7) === 'high');
assert("scoreToSeverity(0.5) === 'medium'",    scoreToSeverity(0.5) === 'medium');
assert("scoreToSeverity(0.4) === 'medium'",    scoreToSeverity(0.4) === 'medium');
assert("scoreToSeverity(0.2) === 'low'",       scoreToSeverity(0.2) === 'low');
assert("scoreToSeverity(0.0) === 'info'",      scoreToSeverity(0.0) === 'info');
assert("scoreToSeverity(0.1) === 'info'",      scoreToSeverity(0.1) === 'info');

// --- computeRiskScore ---
const highConf = computeRiskScore({ severity: 'high', confidence: 0.8 });
assert('computeRiskScore high/0.8 is a number',         typeof highConf === 'number');
assert('computeRiskScore high/0.8 is between 0 and 1',  highConf >= 0 && highConf <= 1);

const critConf = computeRiskScore({ severity: 'critical', confidence: 1.0 });
assert('computeRiskScore critical/1.0 > high/0.8',      critConf > highConf);
assert('computeRiskScore critical/1.0 <= 1',            critConf <= 1);

const withObs = computeRiskScore({ severity: 'high', confidence: 0.8, observationCount: 5 });
const noObs   = computeRiskScore({ severity: 'high', confidence: 0.8, observationCount: 1 });
assert('more observations raises risk score',           withObs > noObs);

const lowConf = computeRiskScore({ severity: 'low', confidence: 0.5 });
assert('computeRiskScore low/0.5 >= 0',                 lowConf >= 0);
assert('computeRiskScore low/0.5 <= 1',                 lowConf <= 1);

// observationCount capped at 5
const cap5 = computeRiskScore({ severity: 'high', confidence: 0.8, observationCount: 10 });
assert('observationCount capped at 5 (same as obs=5)',  cap5 === withObs);

// --- OWASP_ASI ---
assert("OWASP_ASI['ASI01'].title === 'Agent Goal Hijack'",
  OWASP_ASI['ASI01'].title === 'Agent Goal Hijack');
assert("OWASP_ASI['ASI01'].id === 'ASI01'",   OWASP_ASI['ASI01'].id === 'ASI01');
assert("OWASP_ASI['ASI10'] is defined",       typeof OWASP_ASI['ASI10'] === 'object');
assert("All 10 ASI entries present",          Object.keys(OWASP_ASI).length === 10);
assert("Each entry has mitigations array",
  Object.values(OWASP_ASI).every((e) => Array.isArray(e.mitigations) && e.mitigations.length > 0));
assert("Each entry has severity",
  Object.values(OWASP_ASI).every((e) => typeof e.severity === 'string'));

// --- mapCategoryToASI ---
const pkgVuln = mapCategoryToASI('package_vulnerability');
assert("mapCategoryToASI('package_vulnerability') includes 'ASI04'", pkgVuln.includes('ASI04'));
assert("mapCategoryToASI('package_vulnerability') is an array",      Array.isArray(pkgVuln));

const internetNoise = mapCategoryToASI('internet_noise');
assert("mapCategoryToASI('internet_noise') returns an array",        Array.isArray(internetNoise));
assert("mapCategoryToASI('internet_noise') is non-empty",            internetNoise.length > 0);

const malware = mapCategoryToASI('malware_reputation');
assert("mapCategoryToASI('malware_reputation') includes 'ASI01'",   malware.includes('ASI01'));

const phishing = mapCategoryToASI('phishing');
assert("mapCategoryToASI('phishing') includes 'ASI09'",             phishing.includes('ASI09'));

const unknown = mapCategoryToASI('totally_unknown_category');
assert("mapCategoryToASI(unknown) returns array",                    Array.isArray(unknown));

// --- mapASIToAttackTechnique ---
assert("mapASIToAttackTechnique('ASI01') is a string",
  typeof mapASIToAttackTechnique('ASI01') === 'string');
assert("mapASIToAttackTechnique('ASI04') === 'T1195'",
  mapASIToAttackTechnique('ASI04') === 'T1195');
assert("mapASIToAttackTechnique('ASI09') === 'T1204'",
  mapASIToAttackTechnique('ASI09') === 'T1204');
assert("mapASIToAttackTechnique('ASI99') === null",
  mapASIToAttackTechnique('ASI99') === null);

// --- Result ---
if (failed > 0) {
  console.error(`\nArsenal risk scoring tests: ${passed} passed, ${failed} failed.`);
  process.exit(1);
}
console.log(`Arsenal risk scoring tests passed. (${passed} assertions)`);
