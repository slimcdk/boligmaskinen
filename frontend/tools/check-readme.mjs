// Checks that the README lists every source the map uses: each source in SOURCES
// (src/app/panel/about-dialog.ts), which "About the data" credits, has a row under "## Data sources"
// in ../README.md that names it and links to it as SOURCES does.
import { readFileSync } from 'node:fs';

const about = readFileSync(new URL('../src/app/panel/about-dialog.ts', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const sources = [...about.matchAll(/^\s+id: '(\w+)', name: '([^']+)', url: '([^']+)',$/gm)].map(([, id, name, url]) => ({ id, name, url }));
const section = readme.split(/^## Data sources$/m)[1]?.split(/^## /m)[0];
const entries = (about.match(/^\s+id: '/gm) ?? []).length;

const problems = [];
if (!sources.length || sources.length !== entries) problems.push(`Read ${sources.length} of the ${entries} sources in about-dialog.ts; an entry should start "id: '…', name: '…', url: '…',"`);
if (!section) problems.push('README.md has no section "## Data sources"');
else {
  for (const s of sources) {
    if (!section.includes(`| [${s.name}](${s.url}) |`)) problems.push(`README.md's data sources lack a row for ${s.name}: | [${s.name}](${s.url}) | … |`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`The README lists all ${sources.length} sources of "About the data".`);
