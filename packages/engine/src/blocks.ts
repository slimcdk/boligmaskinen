/**
 * The weighting as a list of blocks.
 *
 * Every block is a formula (see formula.ts) over the values in values.ts. A preference block
 * gives a score from 0 to 1 per cell and counts with its importance. A requirement block
 * removes the cells where its result is false or 0. Predefined blocks are formulas too, so
 * there is one way to compute everything and the user can always read and change the code.
 *
 * The final weighting is the importance-weighted average of the preferences, renormalised
 * over the blocks that have data in each cell, exactly like the original engine.
 */
import { compileCached, describeError, type FormulaParam, formulaParams } from './formula.ts';
import { type Role } from './types.ts';
import { LANGUAGE_VERSION, languageOf, upgradeCode } from './migrations.ts';
import { formatWithUnit } from './values.ts';

export interface Block {
  id: string;
  name: string;
  code: string;
  /** A preference gives points; a requirement removes the cells where it is false. */
  role: Role;
  /** Weight in the weighting, 0 (off) to MAX_WEIGHT. */
  weight: number;
  /** The predefined block it started from, e.g. "forest" or "place:<id>", to reset it. */
  template?: string;
  /** The version of the block language the code is written for; missing means 1 (see migrations.ts). */
  language?: number;
}

/** The data a formula can read, per evaluated cell. */
export interface BlockInputs {
  names: string[];
  /** Values of one name for every evaluated cell (NaN where there is no data). */
  values(name: string): Float32Array | null;
}

export interface BlocksResult {
  /** 0–100 per cell, or -1 where a requirement fails. */
  scores: Float32Array;
  histogram: Uint32Array;
  /** Per block: its score (preference) or 1/0 (requirement) per cell, NaN without data. */
  values: Map<string, Float32Array>;
  /** Blocks that cannot run, with the reason. */
  issues: Map<string, string>;
  /** True when at least one preference counts. */
  hasScore: boolean;
}

export interface EvaluateOptions {
  /** Blocks to leave out, e.g. ones that failed on the full set of cells. */
  skip?: ReadonlySet<string>;
}

function round(value: number): string {
  if (Number.isNaN(value)) return 'no data';
  return String(Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 1000) / 1000);
}

/** Run one block over n cells, or explain why it cannot run. */
export function runBlock(block: Block, n: number, inputs: BlockInputs): { values: Float32Array } | { issue: string } {
  // Blocks are upgraded when they are loaded; one that could not be runs only when it can be now
  let code = block.code;
  if (languageOf(block) !== LANGUAGE_VERSION) {
    const upgrade = upgradeCode(code, languageOf(block));
    if (!upgrade.ok) return { issue: upgrade.problem! };
    code = upgrade.code;
  }
  const compiled = compileCached(code, inputs.names);
  if (!compiled.ok) return { issue: describeError(compiled.error) };
  const formula = compiled.formula;
  const index = new Map(formula.inputs.map((name, i) => [name, i]));
  const used = formula.uses.map((name) => ({ name, slot: index.get(name)!, values: inputs.values(name) }));
  const missing = used.find((u) => !u.values);
  if (missing) return { issue: `No data for “${missing.name}”` };
  const row = new Float64Array(formula.inputs.length).fill(NaN);
  const out = new Float32Array(n);
  const preference = block.role === 'want';
  let bad = 0;
  let example = '';
  for (let i = 0; i < n; i++) {
    for (const u of used) row[u.slot] = u.values![i];
    const value = formula.run(row);
    if (Number.isNaN(value)) { out[i] = NaN; continue; }
    if (!preference) { out[i] = value !== 0 ? 1 : 0; continue; }
    if (value >= 0 && value <= 1) { out[i] = value; continue; }
    if (!bad++) {
      const at = used.map((u) => `${u.name} = ${round(row[u.slot])}`).join(', ');
      example = `${Number.isFinite(value) ? round(value) : value > 0 ? 'infinity' : '-infinity'}${at ? ` where ${at}` : ''}`;
    }
  }
  if (bad) {
    return { issue: `Gives ${example} (${bad.toLocaleString('en-US')} cell${bad === 1 ? '' : 's'}). A score has to be between 0 and 1; wrap the formula in clamp(…), or use the block as a requirement.` };
  }
  return { values: out };
}

/** Score every cell: the preferences averaged by importance, without cells that fail a requirement. */
export function evaluateBlocks(blocks: Block[], n: number, inputs: BlockInputs, options: EvaluateOptions = {}): BlocksResult {
  const values = new Map<string, Float32Array>();
  const issues = new Map<string, string>();
  const wants: { values: Float32Array; weight: number }[] = [];
  const masks: Float32Array[] = [];
  for (const block of blocks) {
    if (options.skip?.has(block.id) || (block.role === 'want' && block.weight <= 0)) continue;
    const result = runBlock(block, n, inputs);
    if ('issue' in result) { issues.set(block.id, result.issue); continue; }
    values.set(block.id, result.values);
    if (block.role === 'want') wants.push({ values: result.values, weight: block.weight });
    else masks.push(result.values);
  }

  const scores = new Float32Array(n).fill(-1);
  const histogram = new Uint32Array(101);
  if (!wants.length) return { scores, histogram, values, issues, hasScore: false };
  for (let i = 0; i < n; i++) {
    // A requirement fails at 0; missing data (NaN) passes
    let ok = true;
    for (const mask of masks) if (mask[i] === 0) { ok = false; break; }
    if (!ok) continue;
    let sum = 0;
    let weight = 0;
    for (const want of wants) {
      const v = want.values[i];
      if (Number.isNaN(v)) continue;
      sum += v * want.weight;
      weight += want.weight;
    }
    // Without any data the cell keeps full points, as the original engine does
    const value = weight > 0 ? Math.max(0, Math.min(100, (sum / weight) * 100)) : 100;
    scores[i] = value;
    histogram[Math.round(value)]++;
  }
  return { scores, histogram, values, issues, hasScore: true };
}

let counter = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** The weight slider runs from 0 (off) to this. */
export const MAX_WEIGHT = 10;

/** One line about a block for the side panel: its controls' values, or its first comment. */
export function blockSummary(block: Block, params: FormulaParam[] = formulaParams(block.code)): string {
  const parts: string[] = [];
  const flags = params.filter((p) => p.kind === 'flag');
  for (const p of params) {
    if (p.kind === 'number') parts.push(`${p.label} ${formatWithUnit(p.value, p.unit)}`);
    if (p.kind === 'choice') parts.push(capitalise(p.options[p.value - 1] ?? ''));
  }
  if (flags.length) {
    const on = flags.filter((p) => p.value).map((p) => p.label);
    parts.unshift(on.length ? `${block.role === 'must' ? 'Only ' : ''}${on.join(', ')}` : 'Nothing allowed');
  }
  if (!parts.length) {
    const comment = block.code.split('\n').map((l) => l.trim()).find((l) => l.startsWith('//'));
    parts.push(comment ? comment.replace(/^\/\/\s*/, '') : 'Custom code');
  }
  return parts.join(' · ');
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
