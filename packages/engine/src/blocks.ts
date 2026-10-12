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
import { compileCombine } from './codegen.ts';
import { compileCached, describeError, type FormulaParam, formulaParams } from './formula.ts';
import { type Role } from './types.ts';
import { LANGUAGE_VERSION, languageOf, upgradeCode } from './migrations.ts';
import { formatWithUnit } from './values.ts';
import { ENGLISH, fill, word, type Wording } from './wording.ts';

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
  /** The group it is in (maps.ts). */
  group?: string;
  /** False when the user has switched the block off; it then counts for nothing. */
  enabled?: boolean;
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
  let first = -1;
  const loop = formula.loop;
  if (loop) {
    // One loop that V8 compiles: about six times faster than calling the closures per cell
    const columns: (Float32Array | null)[] = formula.inputs.map(() => null);
    for (const u of used) columns[u.slot] = u.values;
    ({ bad, first } = loop(columns, out, n, preference));
  } else {
    for (let i = 0; i < n; i++) {
      for (const u of used) row[u.slot] = u.values![i];
      const value = formula.run(row);
      if (Number.isNaN(value)) { out[i] = NaN; continue; }
      if (!preference) { out[i] = value !== 0 ? 1 : 0; continue; }
      if (value >= 0 && value <= 1) { out[i] = value; continue; }
      if (!bad++) first = i;
    }
  }
  if (bad) {
    // The first cell that gave a score outside 0–1, as an example
    for (const u of used) row[u.slot] = u.values![first];
    const value = formula.run(row);
    const at = used.map((u) => `${u.name} = ${round(row[u.slot])}`).join(', ');
    const example = `${Number.isFinite(value) ? round(value) : value > 0 ? 'infinity' : '-infinity'}${at ? ` where ${at}` : ''}`;
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
  const combine = compileCombine(wants.length, masks.length);
  if (combine) {
    combine(wants.map((w) => w.values), wants.map((w) => w.weight), masks, scores, histogram, n);
    return { scores, histogram, values, issues, hasScore: true };
  }
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

/**
 * A new id, such as `map-3f9a…`. Maps and places are saved on the server, so ids must not clash
 * between devices: 96 random bits. (`crypto.randomUUID` needs HTTPS, and a LAN server has none.)
 */
export function newId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `${prefix}-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** The weight slider runs from 0 (off) to this. */
export const MAX_WEIGHT = 10;

/** One line about a block for the side panel: its controls' values, or its first comment. */
export function blockSummary(block: Block, params: FormulaParam[] = formulaParams(block.code), wording: Wording = ENGLISH): string {
  const parts: string[] = [];
  const flags = params.filter((p) => p.kind === 'flag');
  // The two ends of a ramp are described together, in the direction it points
  const full = params.find((p) => p.kind === 'number' && p.name === 'full');
  const zero = params.find((p) => p.kind === 'number' && p.name === 'zero');
  const ramp = full && zero ? { full, zero } : null;
  for (const p of params) {
    if (p.kind === 'number' && !(ramp && (p === full || p === zero))) parts.push(`${word(wording, p.label)} ${formatWithUnit(p.value, p.unit, wording)}`);
    if (p.kind === 'choice') parts.push(capitalise(word(wording, p.options[p.value - 1] ?? '')));
  }
  if (ramp) {
    const unit = ramp.full.unit || ramp.zero.unit;
    const at = (p: FormulaParam) => formatWithUnit(p.value, p.unit || unit, wording);
    // A distance of 0 m is inside the area a value measures to, such as a district heating area
    const inside = (p: FormulaParam) => unit === 'm' && p.value === 0;
    const template = ramp.full.value <= ramp.zero.value
      ? (inside(ramp.full) ? wording.fullInside : wording.fullUpTo)
      : (inside(ramp.zero) ? wording.noPointsInside : wording.noPointsBelow);
    parts.push(fill(template, { full: at(ramp.full), zero: at(ramp.zero) }));
  }
  // With a ramp, switches that are all on say nothing new, such as every provider of chargers. Of many
  // switches, those on are named when they are few, else those off
  if (flags.length && !(ramp && flags.every((p) => p.value))) {
    const on = flags.filter((p) => p.value).map((p) => word(wording, p.label));
    const off = flags.filter((p) => !p.value).map((p) => word(wording, p.label));
    if (flags.length > 3 && off.length && off.length <= 3 && off.length < on.length) {
      parts.unshift(fill(wording.allBut, { list: off.join(', ') }));
    } else {
      const list = on.length > 3 ? fill(wording.andMore, { list: on.slice(0, 3).join(', '), n: String(on.length - 3) }) : on.join(', ');
      const none = block.role === 'must' ? wording.nothingAllowed : wording.noneTicked;
      parts.unshift(on.length ? (block.role === 'must' ? fill(wording.only, { list }) : list) : none);
    }
  }
  if (!parts.length) {
    const comment = block.code.split('\n').map((l) => l.trim()).find((l) => l.startsWith('//'));
    parts.push(comment ? comment.replace(/^\/\/\s*/, '') : wording.customCode);
  }
  return parts.join(' · ');
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
