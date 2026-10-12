import {
  Block, BlockInputs, boxBlur, compileCached, DATA_VALUES, DecodeContext, decodeValue, distanceLayer, evaluateBlocks, Grid,
  lowerLimit, mercatorFrame, MercatorFrame, minutesLayer, percentile, Place, placeValues, pointsOf, Role, total, ValueInfo, ViewState,
} from '@boligmaskinen/engine';
import type { Scheme } from '../theme/theme.service';
import { BELOW_LIMIT, rampOf, Rgb, stepped } from './colours';
import { positionOf, resample, RoutedTimes } from './travel';

export interface HeatStats {
  hasPreferences: boolean;
  considered: number;
  shown: number;
  limit: number;
  median: number;
  lo: number;
  hi: number;
  histogram: Uint32Array;
}

/**
 * The points of one cell and what they come from. The page puts it into words (map-view.ts), as
 * the worker knows no language.
 */
export interface Breakdown {
  /** The cell's points, or null while nothing is weighed. */
  points: number | null;
  /** A requirement is not met, so the cell is left out. */
  leftOut: boolean;
  /** Whether the cell has address points. */
  homes: boolean;
  municipality: string;
  /** The points of the area around the cell, when the map smooths. */
  area: number | null;
  rows: BreakdownRow[];
}

/** One block's part in a cell's points. */
export interface BreakdownRow {
  id: string;
  role: Role;
  /** The value the block reads, when it reads just one: its name, and its value in the cell. */
  input: { name: string; value: number } | null;
  /** The block's score in the cell, NaN without data; a requirement that is not met gives 0. */
  score: number;
  weight: number;
}

/** A block's result where the map looks, from an even sample of the cells; the page puts it into words. */
export type Preview = { kind: 'noData' } | { kind: 'pass'; percent: number } | { kind: 'median'; score: number };

/** What a heatmap is drawn from: the blocks, the places they read, and how the map shows them. */
export interface HeatRequest {
  blocks: Block[];
  places: Place[];
  view: ViewState;
  scheme: Scheme;
}

/** The limit and the colour scale of the region's map, which its detail is drawn with too. */
export type HeatScale = Pick<HeatStats, 'limit' | 'lo' | 'hi'>;

/** What the page asks the heat worker (heat.worker.ts). */
export type HeatMessage =
  | { type: 'grid'; grid: Grid }
  /** The grid's own cells around the view (detail.ts), or none. */
  | { type: 'detail'; grid: Grid | null }
  | { type: 'render'; id: number; request: HeatRequest; buffer: ArrayBuffer; detail: ArrayBuffer | null }
  | { type: 'explain'; id: number; cell: number; detail: boolean; request: Pick<HeatRequest, 'blocks' | 'places'> }
  /** A place's travel times on the road network (travel.service.ts), on the region's grid. */
  | { type: 'travel'; position: string; times: RoutedTimes };

export interface HeatResult {
  stats: HeatStats;
  /** Each block's result, by its id. */
  previews: [string, Preview][];
  /** Blocks that cannot run, with the reason. */
  issues: [string, string][];
}

/** Colours as little-endian RGBA pixels; the ramps leave alpha to the renderer. */
const pixel = ([r, g, b]: Rgb, alpha = 0) => ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
const packed = new Map<string, Uint32Array>();
/** The colour scale as pixels, per palette, light or dark map and bands. */
function packedRamp(view: Pick<ViewState, 'palette' | 'bands'>, scheme: Scheme): Uint32Array {
  const key = `${view.palette}|${scheme}|${view.bands}`;
  let ramp = packed.get(key);
  if (!ramp) {
    ramp = Uint32Array.from(rampOf(view.palette, scheme, view.bands), (c) => pixel(c));
    packed.set(key, ramp);
  }
  return ramp;
}
const BELOW_LIMIT_PACKED: Record<Scheme, number> = {
  light: pixel(BELOW_LIMIT.light.rgb, BELOW_LIMIT.light.alpha),
  dark: pixel(BELOW_LIMIT.dark.rgb, BELOW_LIMIT.dark.alpha),
};

/** Smoothing radius in metres for "light" and "strong". */
const SMOOTHING_METRES = [0, 200, 500] as const;

/**
 * Turns the blocks into heatmap pixels, statistics, block previews and explanations. It knows no
 * Angular, so it runs in the heat worker (heat.worker.ts), or in the page where there are no workers.
 */
export class HeatEngine {
  readonly grid: Grid;
  private readonly frame: MercatorFrame;
  private buffers: { s: Float32Array; m: Float32Array; sb: Float32Array; mb: Float32Array; tmp: Float32Array; col: Float32Array } | null = null;
  /** Per land cell: the value shown and how much of it is backed by shown cells (reused between renders). */
  private shown: { value: Float32Array; cover: Float32Array } | null = null;
  private coverKey = '';
  private lastRadius = 0;
  private lastIssues = new Map<string, string>();
  /** Decoded values per cell set, value name and place position; layers never change. */
  private readonly valueCache = new Map<string, Float32Array>();
  /** Travel-time layers per place position and mode. */
  private readonly placeLayers = new Map<string, Uint8Array>();
  /** Travel times found on the road network, per place position and mode; they replace the estimates. */
  private readonly routed = new Map<string, Uint8Array>();
  /** The distances to the data pack's points, such as the chargers of an operator, per value name. */
  private readonly siteLayers = new Map<string, Uint8Array>();

  /**
   * `region` is the engine of the region's grid when this one draws the grid's own cells around the
   * view: it takes the distances to points from there, as they reach beyond the view.
   */
  constructor(grid: Grid, private readonly region: HeatEngine | null = null) {
    this.grid = grid;
    this.frame = mercatorFrame(grid);
  }

  /** Every value a block can read: the data, and the travel times to the places. */
  static values(places: Place[]): ValueInfo[] {
    return [...DATA_VALUES, ...placeValues(places)];
  }

  /** The travel times to a place's position on the road network, which replace its estimates. */
  setTravel(position: string, times: Partial<RoutedTimes>): void {
    for (const [mode, layer] of Object.entries(times)) this.routed.set(`${position}|${mode}`, layer);
    // The oldest positions go, as a place that moved is not coming back
    while (this.routed.size > 48) this.routed.delete(this.routed.keys().next().value!);
    for (const key of [...this.placeLayers.keys()]) if (key.startsWith(`${position}|`)) this.placeLayers.delete(key);
    for (const key of [...this.valueCache.keys()]) if (key.endsWith(`|${position}`)) this.valueCache.delete(key);
  }

  /** The distances to the points a value reads, found the first time a block reads them; null without the points. */
  siteLayer(info: ValueInfo): Uint8Array | null {
    let layer = this.siteLayers.get(info.name);
    if (layer) return layer;
    if (this.region) {
      const regional = this.region.siteLayer(info);
      if (!regional) return null;
      layer = resample(this.region.grid, this.grid, regional);
    } else {
      const sites = this.grid.sites?.[info.sites!.file];
      if (!sites) return null;
      layer = distanceLayer(this.grid, this.frame, pointsOf(sites, info.sites!.operators));
    }
    this.siteLayers.set(info.name, layer);
    return layer;
  }

  /** The 8-bit layer behind a value: a data layer, the distance to points, or the travel time to a place. */
  private layerOf(info: ValueInfo, places: Place[]): Uint8Array | null {
    if (info.sites) return this.siteLayer(info);
    if (!info.place) return this.grid.layers[info.kind === 'municipal' ? 'municipality' : info.layer!];
    const place = places.find((p) => p.id === info.place!.id);
    if (!place) return null;
    const key = `${positionOf(place)}|${info.place.mode}`;
    const routed = this.routed.get(key);
    if (routed) return routed;
    let layer = this.placeLayers.get(key);
    if (!layer) {
      layer = minutesLayer(this.grid, this.frame, place.lng, place.lat, info.place.mode);
      this.placeLayers.set(key, layer);
      if (this.placeLayers.size > 24) this.placeLayers.delete(this.placeLayers.keys().next().value!);
    }
    return layer;
  }

  /** Inputs for the blocks: the decoded value of every name, for the given cells. */
  private inputs(cells: Uint32Array, places: Place[], cacheKey: string | null): BlockInputs {
    const grid = this.grid;
    const ctx: DecodeContext = { distanceMax: grid.meta.distanceMax, municipalities: grid.municipalities };
    const values = HeatEngine.values(places);
    const infos = new Map(values.map((v) => [v.name, v]));
    return {
      names: values.map((v) => v.name),
      values: (name) => {
        const info = infos.get(name);
        if (!info) return null;
        const place = info.place && places.find((p) => p.id === info.place!.id);
        const key = cacheKey && `${cacheKey}|${name}|${place ? `${place.lng.toFixed(5)},${place.lat.toFixed(5)}` : ''}`;
        const cached = key ? this.valueCache.get(key) : undefined;
        if (cached) return cached;
        const layer = this.layerOf(info, places);
        if (!layer) return null;
        const lut = new Float32Array(256);
        for (let v = 0; v < 256; v++) lut[v] = decodeValue(info, v, ctx) ?? NaN;
        const out = new Float32Array(cells.length);
        for (let i = 0; i < cells.length; i++) out[i] = lut[layer[cells[i]]];
        if (key) {
          // Old positions of a moved place are not needed again
          if (place) for (const k of this.valueCache.keys()) if (k.startsWith(`${cacheKey}|${name}|`)) this.valueCache.delete(k);
          this.valueCache.set(key, out);
        }
        return out;
      },
    };
  }

  /**
   * Draws the heatmap into `pixels` (RGBA, one 32-bit number per pixel), and says what it shows. The
   * detail of a view is drawn with the limit and colour scale of the region's map (`scale`), so the
   * two look the same.
   */
  render(request: HeatRequest, pixels: Uint32Array, scale?: HeatScale): HeatResult {
    const grid = this.grid;
    const { width, height } = grid;
    const n = width * height;
    this.buffers ??= {
      s: new Float32Array(n), m: new Float32Array(n), sb: new Float32Array(n), mb: new Float32Array(n),
      tmp: new Float32Array(n), col: new Float32Array(width),
    };
    const { view, blocks, places, scheme } = request;
    pixels.fill(0);
    const cells = view.cells === 'homes' ? grid.homeCells : grid.landCells;

    const result = evaluateBlocks(blocks, cells.length, this.inputs(cells, places, view.cells));
    const { scores, histogram } = result;
    const hasPreferences = result.hasScore;
    this.lastIssues = result.issues;
    const previews = this.previews(blocks, result.values);
    const issues = [...result.issues];
    // Which cells are shown only depends on the requirements, so the coverage survives other changes
    const maskKey = JSON.stringify([blocks.filter((b) => b.role === 'must').map((b) => b.code), places]);

    if (!hasPreferences) {
      return { stats: { hasPreferences, considered: 0, shown: 0, limit: 0, median: 0, lo: 0, hi: 100, histogram }, previews, issues };
    }

    const limit = scale ? scale.limit : lowerLimit(histogram, view);
    let shown = 0;
    for (let s = limit; s <= 100; s++) shown += histogram[s];
    const radius = view.smooth ? Math.max(view.smooth, Math.round(SMOOTHING_METRES[view.smooth] / grid.meta.cellMetres)) : 0;
    const b = this.buffers;
    b.s.fill(0);
    b.m.fill(0);
    for (let i = 0; i < cells.length; i++) {
      const score = scores[i];
      if (score >= limit) { b.s[cells[i]] = score; b.m[cells[i]] = 1; }
    }
    if (radius > 0) {
      boxBlur(b.s, b.sb, b.tmp, b.col, width, height, radius);
      const key = `${view.cells}|${limit}|${radius}|${maskKey}`;
      if (key !== this.coverKey) {
        boxBlur(b.m, b.mb, b.tmp, b.col, width, height, radius);
        this.coverKey = key;
      }
    }
    this.lastRadius = radius;

    // The value each region cell shows, and how much of it is backed by shown cells
    const land = grid.landCells;
    if (this.shown?.value.length !== land.length) this.shown = { value: new Float32Array(land.length), cover: new Float32Array(land.length) };
    const { value, cover } = this.shown;
    value.fill(0);
    cover.fill(0);
    const weighted = new Float32Array(101);
    for (let i = 0; i < land.length; i++) {
      const cell = land[i];
      if (radius > 0) {
        const m = b.mb[cell];
        if (m < 0.015) continue;
        value[i] = b.sb[cell] / m;
        cover[i] = Math.min(1, m / 0.18);
      } else {
        if (!b.m[cell]) continue;
        value[i] = b.s[cell];
        cover[i] = 1;
      }
      weighted[Math.round(value[i])] += cover[i];
    }
    // Stretch the colours over the 2nd to 98th percentile of what is shown
    let lo = scale ? scale.lo : percentile(weighted, 0.02);
    let hi = scale ? scale.hi : percentile(weighted, 0.98);
    if (!scale && hi - lo < 6) {
      const mid = (hi + lo) / 2;
      lo = Math.max(0, mid - 3);
      hi = Math.min(100, mid + 3);
    }

    const ramp = packedRamp(view, scheme);
    const below = BELOW_LIMIT_PACKED[scheme];
    if (view.showBelow && view.show !== 'all') {
      for (let i = 0; i < cells.length; i++) {
        const score = scores[i];
        if (score >= 0 && score < limit) pixels[cells[i]] = below;
      }
    }
    for (let i = 0; i < land.length; i++) {
      const c = cover[i];
      if (!c) continue;
      // With steps, a whole step has one colour and one opacity
      const t = stepped(Math.max(0, Math.min(1, (value[i] - lo) / (hi - lo))), view.bands);
      pixels[land[i]] = ((Math.round(255 * c * (0.5 + 0.5 * t)) << 24) | ramp[Math.round(t * 100)]) >>> 0;
    }
    return {
      stats: { hasPreferences, considered: total(histogram), shown, limit, median: percentile(histogram, 0.5), lo, hi, histogram },
      previews, issues,
    };
  }

  /** The median score of preferences and the share of cells that pass requirements, from an even sample. */
  private previews(blocks: Block[], values: Map<string, Float32Array>): [string, Preview][] {
    const out: [string, Preview][] = [];
    for (const block of blocks) {
      const v = values.get(block.id);
      if (!v) continue;
      const stride = Math.max(1, Math.floor(v.length / 4000));
      const sample: number[] = [];
      for (let i = 0; i < v.length; i += stride) if (!Number.isNaN(v[i])) sample.push(v[i]);
      if (!sample.length) { out.push([block.id, { kind: 'noData' }]); continue; }
      if (block.role === 'must') {
        out.push([block.id, { kind: 'pass', percent: Math.round((sample.filter((x) => x > 0).length / sample.length) * 100) }]);
        continue;
      }
      sample.sort((a, b) => a - b);
      out.push([block.id, { kind: 'median', score: sample[Math.floor(sample.length / 2)] }]);
    }
    return out;
  }

  /** Points breakdown for one raster cell, or null outside the region. */
  explain(cell: number, request: Pick<HeatRequest, 'blocks' | 'places'>): Breakdown | null {
    const grid = this.grid;
    if (cell < 0 || cell >= grid.width * grid.height || !(grid.layers.mask[cell] & 1)) return null;
    const municipality = grid.municipalities[grid.layers.municipality[cell]]?.name ?? '';
    const homes = (grid.layers.mask[cell] & 2) > 0;
    const area = this.lastRadius > 0 && this.buffers && this.buffers.mb[cell] > 0.015
      ? Math.round(this.buffers.sb[cell] / this.buffers.mb[cell]) : null;

    // Blocks that failed on the full set of cells give nothing here either
    const { blocks, places } = request;
    const inputs = this.inputs(Uint32Array.of(cell), places, null);
    const result = evaluateBlocks(blocks, 1, inputs, { skip: new Set(this.lastIssues.keys()) });
    const rows: BreakdownRow[] = [];
    for (const block of blocks) {
      const score = result.values.get(block.id)?.[0];
      if (score === undefined || (block.role === 'want' && block.weight <= 0)) continue;
      // The value a block reads when it reads one, e.g. 520 m
      const compiled = compileCached(block.code, inputs.names);
      const used = compiled.ok && compiled.formula.uses.length === 1 ? compiled.formula.uses[0] : null;
      const input = used ? { name: used, value: inputs.values(used)?.[0] ?? NaN } : null;
      rows.push({ id: block.id, role: block.role, input, score, weight: block.weight });
    }
    const leftOut = rows.some((row) => row.role === 'must' && row.score === 0);
    return { points: result.hasScore ? Math.round(result.scores[0]) : null, leftOut, homes, municipality, area, rows };
  }
}
