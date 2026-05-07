#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'references', 'scope-d-reference-catalog.json');
const OUT_PATH = path.join(ROOT, 'references', 'work-orders.md');

function bulletList(items) {
  return (items || []).map((item) => `- ${item}`).join('\n');
}

function codeList(items) {
  return (items || []).map((item) => `\`${item}\``).join(', ');
}

function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  const lines = [];

  lines.push('# SCOPE-D Reference Assimilation Work Orders');
  lines.push('');
  lines.push('Generated deterministically from `references/scope-d-reference-catalog.json`. Do not edit work orders by hand; update the catalog and regenerate.');
  lines.push('');
  lines.push('## Guardrails');
  lines.push('');
  lines.push('- All work orders are defensive by default.');
  lines.push('- Dual-use and adversary-emulation references are taxonomy-only unless explicitly reclassified by policy.');
  lines.push('- No payloads, C2 code, credential theft behavior, destructive automation, or evasion logic may be imported.');
  lines.push('- Every implementation task must preserve SCOPE-D safety boundaries, synthetic-first validation, and receipt verification.');
  lines.push('');

  catalog.references.forEach((ref, index) => {
    const id = `WO-${String(index + 1).padStart(3, '0')}`;
    lines.push(`## ${id}: ${ref.name}`);
    lines.push('');
    lines.push(`- Reference ID: \`${ref.id}\``);
    lines.push(`- URL: ${ref.url}`);
    lines.push(`- Category: \`${ref.category}\``);
    lines.push(`- Adoption mode: \`${ref.adoptionMode}\``);
    lines.push(`- Safety class: \`${ref.safetyClass}\``);
    lines.push(`- Capability targets: ${codeList(ref.capabilityTargets)}`);
    lines.push('');
    lines.push('### Lessons');
    lines.push('');
    lines.push(bulletList(ref.lessons || []));
    lines.push('');
    lines.push('### Do not import');
    lines.push('');
    lines.push(bulletList(ref.doNotImport || []));
    lines.push('');
    lines.push('### Next actions');
    lines.push('');
    lines.push(bulletList(ref.nextActions || []));
    lines.push('');
  });

  fs.writeFileSync(OUT_PATH, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUT_PATH)}`);
}

main();
