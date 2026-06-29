#!/usr/bin/env node
'use strict';

/**
 * arsenal-risk-scoring.js
 * Numeric severity scoring for SCOPE-D detection candidates.
 * Ported from promptfoo/src/redteam/riskScoring.ts (core severity→score logic).
 * No external dependencies.
 */

const SEVERITY_WEIGHTS = {
  critical: 1.0,
  high:     0.75,
  medium:   0.45,
  low:      0.2,
  info:     0.05,
};

/**
 * Map a severity string to a numeric score in [0, 1].
 * @param {string} severity
 * @returns {number}
 */
function severityToScore(severity) {
  const s = String(severity).toLowerCase();
  if (s in SEVERITY_WEIGHTS) return SEVERITY_WEIGHTS[s];
  // Informational aliases
  if (s === 'informational') return SEVERITY_WEIGHTS.info;
  return 0;
}

/**
 * Map a numeric score in [0, 1] to a severity string.
 * Thresholds mirror the promptfoo scoreToLevel scale (normalised to 0-1):
 *   critical ≥ 0.85, high ≥ 0.65, medium ≥ 0.40, low ≥ 0.15, info below
 * @param {number} score
 * @returns {string}
 */
function scoreToSeverity(score) {
  if (score >= 0.85) return 'critical';
  if (score >= 0.65) return 'high';
  if (score >= 0.40) return 'medium';
  if (score >= 0.15) return 'low';
  return 'info';
}

/**
 * Compute a risk score for a detection candidate.
 *
 * Formula:
 *   base    = severityToScore(severity)
 *   obs_mod = 1 + 0.1 * min(observationCount || 1, 5) - 0.1
 *   score   = base * confidence * obs_mod
 *
 * The observation modifier adds up to +0.4 for candidates backed by 5+
 * independent observations, keeping the result in [0, 1].
 *
 * @param {{ severity: string, confidence: number, observationCount?: number }} candidate
 * @returns {number}
 */
function computeRiskScore(candidate) {
  const base = severityToScore(candidate.severity);
  const confidence = typeof candidate.confidence === 'number' ? candidate.confidence : 1;
  const obsCount = Math.min(candidate.observationCount || 1, 5);
  const obsMod = 1 + 0.1 * obsCount - 0.1;
  const raw = base * confidence * obsMod;
  // Clamp to [0, 1]
  return Math.min(1, Math.max(0, raw));
}

module.exports = { computeRiskScore, severityToScore, scoreToSeverity, SEVERITY_WEIGHTS };
