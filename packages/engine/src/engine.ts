/**
 * The weighting engine. Framework-free so it can move to a shared package and run
 * in the browser (live) and on the server (nightly alerts) with identical results.
 *
 * Every criterion reads one 8-bit layer. Its curve and weight are baked into a
 * 256-entry lookup table, so scoring a cell is a handful of table lookups.
 */
import { type CriterionKind, type Municipality, type MunicipalField, type Role, type ViewState } from './types.ts';

/** Everything the engine needs to know about one criterion or place. */
export interface ScoringItem {
  id: string;
  kind: CriterionKind;
  role: Role;
  weight: number;
  full: number;
  zero: number;
  layer: Uint8Array;
  allowed?: number[];
  field?: MunicipalField;
}

export interface DecodeContext {
  distanceMax: number;
  municipalities: (Municipality | undefined)[];
}

export interface Lut {
  layer: Uint8Array;
  /** Points for each raw value (weight × utility). */
  points: Float32Array;
  /** Weight that counts for each raw value; 0 where the value is missing. */
  available: Float32Array;
  /** 1 where a requirement is met. */
  pass: Uint8Array;
}

export interface ScoreResult {
  /** Score 0–100 per cell, or -1 where a requirement is not met. */
  scores: Float32Array;
  /** Count of cells per rounded score 0–100 (requirement failures excluded). */
  histogram: Uint32Array;
}

/** Decode a raw cell value into its real-world value, or null when the value is missing. */
export function decodeValue(item: Pick<ScoringItem, 'kind' | 'field'>, raw: number, ctx: DecodeContext): number | null {
  switch (item.kind) {
    case 'distance':
      return ctx.distanceMax * Math.pow(raw / 255, 2);
    case 'noise':
      return raw === 0 ? null : raw % 100;
    case 'count':
    case 'minutes':
    case 'category':
      return raw;
    case 'municipal': {
      const municipality = ctx.municipalities[raw];
      return municipality && item.field ? municipality[item.field] : null;
    }
  }
}

/**
 * Linear utility between the full-points value and the no-points value.
 * Works in both directions: closer-is-better (full < zero) and further-is-better (full > zero).
 */
export function utility(full: number, zero: number, value: number): number {
  if (full === zero) return (full > zero ? value >= full : value <= full) ? 1 : 0;
  return Math.max(0, Math.min(1, (zero - value) / (zero - full)));
}

export function buildLut(item: ScoringItem, ctx: DecodeContext): Lut {
  const points = new Float32Array(256);
  const available = new Float32Array(256);
  const pass = new Uint8Array(256);
  for (let raw = 0; raw < 256; raw++) {
    if (item.kind === 'category') {
      const ok = (item.allowed ?? []).includes(raw);
      pass[raw] = ok ? 1 : 0;
      points[raw] = ok ? item.weight : 0;
      available[raw] = raw === 0 ? 0 : item.weight;
      continue;
    }
    const value = decodeValue(item, raw, ctx);
    if (value === null) {
      pass[raw] = 1; // missing data never removes a cell
      continue;
    }
    const u = utility(item.full, item.zero, value);
    pass[raw] = u > 0 ? 1 : 0;
    points[raw] = item.weight * u;
    available[raw] = item.weight;
  }
  return { layer: item.layer, points, available, pass };
}

/** Score the given cells. Weights are renormalised per cell over the criteria that have data. */
export function scoreCells(items: ScoringItem[], cells: Uint32Array, ctx: DecodeContext): ScoreResult {
  const wants = items.filter((i) => i.role === 'want' && i.weight > 0).map((i) => buildLut(i, ctx));
  const musts = items.filter((i) => i.role === 'must').map((i) => buildLut(i, ctx));
  const scores = new Float32Array(cells.length);
  const histogram = new Uint32Array(101);
  for (let n = 0; n < cells.length; n++) {
    const cell = cells[n];
    let ok = true;
    for (let m = 0; m < musts.length; m++) {
      if (!musts[m].pass[musts[m].layer[cell]]) { ok = false; break; }
    }
    if (!ok) { scores[n] = -1; continue; }
    let sum = 0;
    let weight = 0;
    for (let k = 0; k < wants.length; k++) {
      const raw = wants[k].layer[cell];
      sum += wants[k].points[raw];
      weight += wants[k].available[raw];
    }
    const score = weight > 0 ? (sum / weight) * 100 : 100;
    scores[n] = score;
    histogram[Math.round(score)]++;
  }
  return { scores, histogram };
}

export function total(histogram: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < histogram.length; i++) sum += histogram[i];
  return sum;
}

/** The lowest score shown: 0 for "all", a fixed score, or the score that keeps the best X %. */
export function lowerLimit(histogram: Uint32Array, view: Pick<ViewState, 'show' | 'top' | 'abs'>): number {
  if (view.show === 'all') return 0;
  if (view.show === 'abs') return view.abs;
  const target = Math.max(1, Math.ceil((total(histogram) * view.top) / 100));
  let accumulated = 0;
  for (let score = 100; score >= 0; score--) {
    accumulated += histogram[score];
    if (accumulated >= target) return score;
  }
  return 0;
}

/** Score at quantile q (0–1) of a 101-bin histogram. */
export function percentile(histogram: ArrayLike<number>, q: number): number {
  const n = total(histogram);
  if (!n) return 0;
  let accumulated = 0;
  for (let score = 0; score < histogram.length; score++) {
    accumulated += histogram[score];
    if (accumulated >= q * n) return score;
  }
  return histogram.length - 1;
}

/**
 * Separable box blur applied twice (close to a Gaussian), edges clamped.
 * Both directions walk memory row by row; the vertical pass keeps one running sum per column.
 */
export function boxBlur(src: Float32Array, dst: Float32Array, tmp: Float32Array, colSum: Float32Array, width: number, height: number, radius: number): void {
  const inv = 1 / (2 * radius + 1);
  const pass = (from: Float32Array, to: Float32Array) => {
    for (let y = 0; y < height; y++) {
      const row = y * width;
      let acc = 0;
      for (let x = -radius; x <= radius; x++) acc += from[row + (x < 0 ? 0 : x >= width ? width - 1 : x)];
      for (let x = 0; x < width; x++) {
        tmp[row + x] = acc * inv;
        const add = x + radius + 1;
        const sub = x - radius;
        acc += from[row + (add >= width ? width - 1 : add)] - from[row + (sub < 0 ? 0 : sub)];
      }
    }
    colSum.fill(0);
    for (let y = -radius; y <= radius; y++) {
      const row = (y < 0 ? 0 : y >= height ? height - 1 : y) * width;
      for (let x = 0; x < width; x++) colSum[x] += tmp[row + x];
    }
    for (let y = 0; y < height; y++) {
      const out = y * width;
      const addRow = Math.min(height - 1, y + radius + 1) * width;
      const subRow = Math.max(0, y - radius) * width;
      for (let x = 0; x < width; x++) {
        to[out + x] = colSum[x] * inv;
        colSum[x] += tmp[addRow + x] - tmp[subRow + x];
      }
    }
  };
  pass(src, dst);
  pass(dst, dst);
}
