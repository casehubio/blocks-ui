#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const COMPONENT_DIRS = ['components', 'packages/blocks-ui-core/src'];

const ARIA_PATTERNS = [
  /role[=:"']/,
  /aria-[a-z]/,
  /setAttribute\(\s*['"]role['"]/,
  /setAttribute\(\s*['"]aria-/,
  /override\s+aria[A-Z]/,
  /\.role\s*=/,
];

const EXEMPT = new Set([
  'index.ts',
  'types.ts',
  'api.ts',
  'events.ts',
  'columns.ts',
  'styles.ts',
]);

function findComponentFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory() && entry !== 'node_modules' && entry !== 'dist') {
      results.push(...findComponentFiles(full));
    } else if (
      entry.endsWith('.ts') &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.d.ts') &&
      !EXEMPT.has(entry)
    ) {
      const content = readFileSync(full, 'utf-8');
      if (content.includes('@customElement(')) {
        results.push({ path: full, content });
      }
    }
  }
  return results;
}

let failures = 0;
let checked = 0;

for (const baseDir of COMPONENT_DIRS) {
  const absDir = join(ROOT, baseDir);
  let entries;
  try {
    entries = readdirSync(absDir);
  } catch {
    continue;
  }

  const files = findComponentFiles(absDir);
  for (const { path, content } of files) {
    checked++;
    const hasAria = ARIA_PATTERNS.some(p => p.test(content));
    if (!hasAria) {
      const rel = relative(ROOT, path);
      console.error(`FAIL  ${rel} — no ARIA attributes found`);
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} component(s) missing ARIA out of ${checked} checked.`);
  console.error('Every @customElement must have role and/or aria-label attributes.');
  process.exit(1);
} else {
  console.log(`OK  ${checked} component(s) checked — all have ARIA attributes.`);
}
