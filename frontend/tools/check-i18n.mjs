// Checks the app's texts before the tests run: every key the code names is in the English
// catalogue, and the Danish one has the same keys with the same {{ placeholders }}. Keys built at
// run time ('jobs.filter.' + id) are not seen here; their groups are checked by the catalogues.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/', import.meta.url).pathname;
const en = JSON.parse(readFileSync(join(root, 'i18n/en.json'), 'utf8'));
const da = JSON.parse(readFileSync(join(root, 'i18n/da.json'), 'utf8'));
/** Danish only: their English is in the code (SOURCES) or comes from the server (the jobs). */
const DANISH_ONLY = ['about.sources.', 'jobs.byId.'];

function leaves(node, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'string') out.set(prefix + key, value);
    else leaves(value, `${prefix}${key}.`, out);
  }
  return out;
}

const placeholders = (text) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');
const english = leaves(en);
const danish = leaves(da);
const problems = [];
for (const [key, text] of english) {
  if (!danish.has(key)) problems.push(`da.json lacks ${key}`);
  else if (placeholders(text) !== placeholders(danish.get(key))) problems.push(`da.json has other placeholders in ${key}`);
}
for (const key of danish.keys()) {
  if (!english.has(key) && !DANISH_ONLY.some((prefix) => key.startsWith(prefix))) problems.push(`en.json lacks ${key}`);
}

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (/\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts')) yield path;
  }
}

// 'key' | transloco, t('key'), i18n.t('key'), and keys picked between: ('a' : 'b') | transloco
const USES = [/'([a-zA-Z]+(?:\.[a-zA-Z0-9]+)+)'\s*\)?\s*\|\s*transloco/g, /\bt\(\s*'([a-zA-Z]+(?:\.[a-zA-Z0-9]+)+)'/g, /\?\s*'([a-zA-Z]+(?:\.[a-zA-Z0-9]+)+)'\s*:\s*'([a-zA-Z]+(?:\.[a-zA-Z0-9]+)+)'/g];
let used = 0;
for (const path of files(join(root, 'app'))) {
  const text = readFileSync(path, 'utf8');
  for (const pattern of USES) {
    for (const match of text.matchAll(pattern)) {
      for (const key of match.slice(1).filter(Boolean)) {
        used++;
        if (!english.has(key)) problems.push(`${path.slice(root.length)} names ${key}, which en.json does not have`);
      }
    }
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`The catalogues agree: ${english.size} texts, ${used} uses in the code.`);
