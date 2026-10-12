// The share of a part's lines its tests run, from Vitest's json-summary or coverage.py's JSON
// report: into the job's summary, and into its output `coverage`, which the badges job reads.
//
//   node coverage.mjs <part> <report>
import { appendFileSync, readFileSync } from 'node:fs';

const [part, file] = process.argv.slice(2);
const report = JSON.parse(readFileSync(file, 'utf8'));
// Vitest (Istanbul) counts lines; coverage.py counts statements, which are lines here too
const { covered, total } = report.total
  ? { covered: report.total.lines.covered, total: report.total.lines.total }
  : { covered: report.totals.covered_lines, total: report.totals.num_statements };
const percent = total ? (100 * covered) / total : 0;
const line = `${part}: ${percent.toFixed(1)} % of the lines are covered by the tests (${covered} of ${total})`;
console.log(line);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `coverage=${JSON.stringify({ covered, total })}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `**Coverage.** ${line}.\n`);
