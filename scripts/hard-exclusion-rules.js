#!/usr/bin/env node
'use strict';

/**
 * Hard exclusion rules for Arsenal detection candidates and intelligence findings.
 * Ported from claude-code-security-review HardExclusionRules (Python).
 *
 * These patterns catch well-known false-positive families that add noise before
 * findings reach the operator. The rules are applied as a pre-gate — no LLM call,
 * no schema validation, just fast regex matching on title + description text.
 */

const DOS_PATTERNS = [
  /\b(denial of service|dos attack|resource exhaustion)\b/i,
  /\b(exhaust|overwhelm|overload).{0,30}(resource|memory|cpu)\b/i,
  /\b(infinite|unbounded).{0,20}(loop|recursion)\b/i,
];

const RATE_LIMITING_PATTERNS = [
  /\b(missing|lack of|no)\s+rate\s+limit/i,
  /\brate\s+limiting\s+(missing|required|not implemented)/i,
  /\b(implement|add)\s+rate\s+limit/i,
  /\bunlimited\s+(requests|calls|api)\b/i,
];

const RESOURCE_PATTERNS = [
  /\b(resource|memory|file)\s+leak\s+potential/i,
  /\bunclosed\s+(resource|file|connection)\b/i,
  /\b(close|cleanup|release)\s+(resource|file|connection)\b/i,
  /\bpotential\s+memory\s+leak\b/i,
  /\b(database|thread|socket|connection)\s+leak\b/i,
];

const OPEN_REDIRECT_PATTERNS = [
  /\b(open redirect|unvalidated redirect)\b/i,
  /\b(redirect.{0,10}(attack|exploit|vulnerability))\b/i,
  /\b(malicious.{0,10}redirect)\b/i,
];

const MEMORY_SAFETY_PATTERNS = [
  /\b(buffer overflow|stack overflow|heap overflow)\b/i,
  /\b(oob)\s+(read|write|access)\b/i,
  /\bout.?of.?bounds?\b/i,
  /\b(memory safety|memory corruption)\b/i,
  /\buse.?after.?free\b/i,
  /\bdouble.?free\b/i,
  /\bnull.?pointer.?dereference\b/i,
  /\b(segmentation fault|segfault|memory violation)\b/i,
  /\b(integer overflow|integer underflow|integer conversion)\b/i,
  /\barbitrary.{0,20}(memory read|pointer dereference|memory address)\b/i,
];

const REGEX_INJECTION_PATTERNS = [
  /\b(regex|regular expression)\s+injection\b/i,
  /\b(regex|regular expression)\s+denial of service\b/i,
  /\b(regex|regular expression)\s+flooding\b/i,
];

const SSRF_PATTERNS = [
  /\b(ssrf|server\s+.?side\s+.?request\s+.?forgery)\b/i,
];

const C_CPP_EXTENSIONS = new Set(['.c', '.cc', '.cpp', '.h', '.hpp']);
const HTML_EXTENSIONS = new Set(['.html', '.htm']);

/**
 * @param {string} filePath
 * @returns {string}
 */
function fileExt(filePath) {
  const dot = filePath.lastIndexOf('.');
  return dot >= 0 ? filePath.slice(dot).toLowerCase() : '';
}

/**
 * Returns an exclusion reason string if the finding should be excluded,
 * or null if it should be kept.
 *
 * @param {{ file?: string, title?: string, description?: string, category?: string }} finding
 * @returns {string | null}
 */
function getExclusionReason(finding) {
  const filePath = finding.file || '';
  const ext = fileExt(filePath);

  if (ext === '.md') return 'Finding in Markdown documentation file';

  const combined = `${finding.title || ''} ${finding.description || ''}`;

  for (const re of DOS_PATTERNS) {
    if (re.test(combined)) return 'Generic DOS/resource exhaustion finding (low signal)';
  }
  for (const re of RATE_LIMITING_PATTERNS) {
    if (re.test(combined)) return 'Generic rate limiting recommendation';
  }
  for (const re of RESOURCE_PATTERNS) {
    if (re.test(combined)) return 'Resource management finding (not a security vulnerability)';
  }
  for (const re of OPEN_REDIRECT_PATTERNS) {
    if (re.test(combined)) return 'Open redirect vulnerability (not high impact)';
  }
  for (const re of REGEX_INJECTION_PATTERNS) {
    if (re.test(combined)) return 'Regex injection finding (not applicable)';
  }
  if (!C_CPP_EXTENSIONS.has(ext)) {
    for (const re of MEMORY_SAFETY_PATTERNS) {
      if (re.test(combined)) return 'Memory safety finding in non-C/C++ code (not applicable)';
    }
  }
  if (HTML_EXTENSIONS.has(ext)) {
    for (const re of SSRF_PATTERNS) {
      if (re.test(combined)) return 'SSRF finding in HTML file (not applicable to client-side code)';
    }
  }
  return null;
}

/**
 * Filter an array of findings, returning only those that pass all hard rules.
 *
 * @param {Array<object>} findings
 * @returns {{ kept: Array<object>, excluded: Array<{finding: object, reason: string}> }}
 */
function applyHardExclusions(findings) {
  const kept = [];
  const excluded = [];
  for (const finding of findings) {
    const reason = getExclusionReason(finding);
    if (reason) {
      excluded.push({ finding, reason });
    } else {
      kept.push(finding);
    }
  }
  return { kept, excluded };
}

module.exports = { getExclusionReason, applyHardExclusions };
