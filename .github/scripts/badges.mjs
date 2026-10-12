// The badges in the README, as shields.io endpoint files (https://shields.io/badges/endpoint-badge):
// the results of the jobs of this run of CI, and the coverage of each part's tests. The badges job
// passes the jobs it needs in NEEDS and keeps the files on the badges branch.
//
//   node badges.mjs <folder>     the folder holds the badges there are, and gets the new ones
//
// A part whose tests failed reports no coverage; its badge keeps the coverage measured before.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const folder = process.argv[2];
const needs = JSON.parse(process.env.NEEDS ?? '{}');
const PARTS = ['engine', 'frontend', 'backend', 'pipeline'];

function badge(name, label, message, color) {
  writeFileSync(join(folder, `${name}.json`), `${JSON.stringify({ schemaVersion: 1, label, message, color })}\n`);
}

/** passing when every job succeeded, failing when one failed, and otherwise (cancelled) unknown. */
function result(...jobs) {
  const results = jobs.map((job) => needs[job]?.result);
  if (results.every((r) => r === 'success')) return ['passing', 'brightgreen'];
  if (results.includes('failure')) return ['failing', 'red'];
  return ['unknown', 'lightgrey'];
}

function colour(percent) {
  return percent >= 90 ? 'brightgreen' : percent >= 80 ? 'green' : percent >= 70 ? 'yellowgreen' : percent >= 60 ? 'yellow' : percent >= 50 ? 'orange' : 'red';
}

badge('tests', 'unit tests', ...result('engine', 'frontend', 'backend', 'pipeline'));
badge('e2e', 'end-to-end tests', ...result('e2e', 'compose'));
const image = needs.image?.result;
badge('image', 'docker image', ...(image === 'success' ? ['amd64 | arm64', 'brightgreen'] : image === 'failure' ? ['failing', 'red'] : ['not built', 'lightgrey']));

// The lines covered per part: this run's, or else the ones kept from before
const dataFile = join(folder, 'coverage-data.json');
const data = existsSync(dataFile) ? JSON.parse(readFileSync(dataFile, 'utf8')) : {};
for (const part of PARTS) {
  const measured = needs[part]?.outputs?.coverage;
  if (measured) data[part] = JSON.parse(measured);
}
writeFileSync(dataFile, `${JSON.stringify(data, null, 2)}\n`);

let covered = 0;
let total = 0;
for (const part of PARTS) {
  if (!data[part]) continue;
  const percent = data[part].total ? (100 * data[part].covered) / data[part].total : 0;
  badge(`coverage-${part}`, `${part} coverage`, `${Math.floor(percent)}%`, colour(percent));
  covered += data[part].covered;
  total += data[part].total;
}
if (total) badge('coverage', 'coverage', `${Math.floor((100 * covered) / total)}%`, colour((100 * covered) / total));
