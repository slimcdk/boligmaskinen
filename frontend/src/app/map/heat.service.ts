import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { PilotData } from '../data/pilot-data';
import { Store } from '../state/store';
import { Scheme, ThemeService } from '../theme/theme.service';
import {
  BlockInputs, boxBlur, compileCached, DATA_VALUES, DecodeContext, decodeValue, evaluateBlocks, formatValueOf, Grid,
  lowerLimit, mercatorFrame, MercatorFrame, minutesLayer, percentile, placeValues, total, ValueInfo, ViewState,
} from '@boligmaskinen/engine';
import { BELOW_LIMIT, rampOf, Rgb, stepped } from './colours';

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

export interface Breakdown {
  title: string;
  subtitle: string;
  rows: { name: string; value: string; result: string; failed: boolean }[];
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

/** Turns the blocks into a heatmap canvas, statistics, block previews and explanations. */
@Injectable({ providedIn: 'root' })
export class HeatService {
  private readonly data = inject(PilotData);
  private readonly store = inject(Store);
  private readonly theme = inject(ThemeService);

  readonly canvas = document.createElement('canvas');
  /** Increments every time the canvas has new pixels. */
  readonly frame = signal(0);
  readonly stats = signal<HeatStats | null>(null);
  /** Each block's result in words, e.g. "Median score 0.62" or "84 % of the cells pass". */
  readonly preview = signal<Map<string, string>>(new Map());
  /** Blocks that cannot run, with the reason. */
  readonly issues = signal<Map<string, string>>(new Map());

  private image: ImageData | null = null;
  private buffers: { s: Float32Array; m: Float32Array; sb: Float32Array; mb: Float32Array; tmp: Float32Array; col: Float32Array } | null = null;
  /** Per land cell: the value shown and how much of it is backed by shown cells (reused between renders). */
  private shown: { value: Float32Array; cover: Float32Array } | null = null;
  private pixels: Uint32Array | null = null;
  private coverKey = '';
  private pending = false;
  private lastRadius = 0;
  /** Decoded values per cell set, value name and place position; layers never change. */
  private valueCache = new Map<string, Float32Array>();
  /** Travel-time layers per place position and mode. */
  private placeLayers = new Map<string, Uint8Array>();

  private readonly mercator = computed<MercatorFrame | null>(() => {
    const grid = this.data.grid();
    return grid ? mercatorFrame(grid) : null;
  });

  /** Every value a block can read: the data, and the travel times to the user's places. */
  readonly values = computed<ValueInfo[]>(() => [...DATA_VALUES, ...placeValues(this.store.places())]);
  readonly names = computed(() => this.values().map((v) => v.name));

  constructor() {
    effect(() => {
      const grid = this.data.grid();
      this.store.activeBlocks();
      this.store.places();
      this.store.view();
      this.theme.scheme();
      if (grid) this.schedule();
    });
  }

  private schedule(): void {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.render();
    });
  }

  /** The 8-bit layer behind a value: a data layer, or the travel time to a place. */
  private layerOf(info: ValueInfo, grid: Grid): Uint8Array | null {
    if (!info.place) return grid.layers[info.kind === 'municipal' ? 'municipality' : info.layer!];
    const frame = this.mercator();
    const place = this.store.places().find((p) => p.id === info.place!.id);
    if (!frame || !place) return null;
    const key = `${place.lng.toFixed(5)},${place.lat.toFixed(5)}|${info.place.mode}`;
    let layer = this.placeLayers.get(key);
    if (!layer) {
      layer = minutesLayer(grid, frame, place.lng, place.lat, info.place.mode);
      this.placeLayers.set(key, layer);
      if (this.placeLayers.size > 24) this.placeLayers.delete(this.placeLayers.keys().next().value!);
    }
    return layer;
  }

  /** Inputs for the blocks: the decoded value of every name, for the given cells. */
  private inputs(grid: Grid, cells: Uint32Array, cacheKey: string | null): BlockInputs {
    const ctx: DecodeContext = { distanceMax: grid.meta.distanceMax, municipalities: grid.municipalities };
    const infos = new Map(this.values().map((v) => [v.name, v]));
    return {
      names: this.names(),
      values: (name) => {
        const info = infos.get(name);
        if (!info) return null;
        const place = info.place && this.store.places().find((p) => p.id === info.place!.id);
        const key = cacheKey && `${cacheKey}|${name}|${place ? `${place.lng.toFixed(5)},${place.lat.toFixed(5)}` : ''}`;
        const cached = key ? this.valueCache.get(key) : undefined;
        if (cached) return cached;
        const layer = this.layerOf(info, grid);
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

  private render(): void {
    const grid = this.data.grid();
    if (!grid) return;
    const { width, height } = grid;
    const n = width * height;
    if (!this.image) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.image = this.canvas.getContext('2d')!.createImageData(width, height);
      this.buffers = {
        s: new Float32Array(n), m: new Float32Array(n), sb: new Float32Array(n), mb: new Float32Array(n),
        tmp: new Float32Array(n), col: new Float32Array(width),
      };
    }
    const view = this.store.view();
    // One 32-bit write per pixel; the canvas is RGBA in memory, which is little-endian ABGR as a number
    const pixels = (this.pixels ??= new Uint32Array(this.image.data.buffer));
    pixels.fill(0);
    const cells = view.cells === 'homes' ? grid.homeCells : grid.landCells;

    const blocks = this.store.activeBlocks();
    const result = evaluateBlocks(blocks, cells.length, this.inputs(grid, cells, view.cells));
    const { scores, histogram } = result;
    const hasPreferences = result.hasScore;
    this.issues.set(result.issues);
    this.preview.set(this.previews(result.values));
    // Which cells are shown only depends on the requirements, so the coverage survives other changes
    const maskKey = JSON.stringify([blocks.filter((b) => b.role === 'must').map((b) => b.code), this.store.places()]);

    if (!hasPreferences) {
      this.canvas.getContext('2d')!.putImageData(this.image, 0, 0);
      this.stats.set({ hasPreferences, considered: 0, shown: 0, limit: 0, median: 0, lo: 0, hi: 100, histogram });
      this.frame.update((f) => f + 1);
      return;
    }

    const limit = lowerLimit(histogram, view);
    let shown = 0;
    for (let s = limit; s <= 100; s++) shown += histogram[s];
    const radius = view.smooth ? Math.max(view.smooth, Math.round(SMOOTHING_METRES[view.smooth] / grid.meta.cellMetres)) : 0;
    const b = this.buffers!;
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
    let lo = percentile(weighted, 0.02);
    let hi = percentile(weighted, 0.98);
    if (hi - lo < 6) {
      const mid = (hi + lo) / 2;
      lo = Math.max(0, mid - 3);
      hi = Math.min(100, mid + 3);
    }

    const scheme = this.theme.scheme();
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
    this.canvas.getContext('2d')!.putImageData(this.image, 0, 0);

    this.stats.set({ hasPreferences, considered: total(histogram), shown, limit, median: percentile(histogram, 0.5), lo, hi, histogram });
    this.frame.update((f) => f + 1);
  }

  /** "Median score 0.62" for preferences and "84 % of the cells pass" for requirements, from an even sample. */
  private previews(values: Map<string, Float32Array>): Map<string, string> {
    const out = new Map<string, string>();
    for (const block of this.store.blocks()) {
      const v = values.get(block.id);
      if (!v) continue;
      const stride = Math.max(1, Math.floor(v.length / 4000));
      const sample: number[] = [];
      for (let i = 0; i < v.length; i += stride) if (!Number.isNaN(v[i])) sample.push(v[i]);
      if (!sample.length) { out.set(block.id, 'No data where the map looks'); continue; }
      if (block.role === 'must') {
        out.set(block.id, `${Math.round((sample.filter((x) => x > 0).length / sample.length) * 100)} % of the cells pass`);
        continue;
      }
      sample.sort((a, b) => a - b);
      out.set(block.id, `Median score ${sample[Math.floor(sample.length / 2)].toFixed(2)}`);
    }
    return out;
  }

  /** Points breakdown for one raster cell, or null outside the region. */
  explain(cell: number): Breakdown | null {
    const grid = this.data.grid();
    if (!grid || cell < 0 || !(grid.layers.mask[cell] & 1)) return null;
    const municipality = grid.municipalities[grid.layers.municipality[cell]];
    const homes = (grid.layers.mask[cell] & 2) > 0 ? 'Cell with homes' : 'No address points in this cell';
    const area = this.lastRadius > 0 && this.buffers && this.buffers.mb[cell] > 0.015
      ? ` · area ${Math.round(this.buffers.sb[cell] / this.buffers.mb[cell])} points` : '';

    // Blocks that failed on the full set of cells give nothing here either
    const blocks = this.store.activeBlocks();
    const inputs = this.inputs(grid, Uint32Array.of(cell), null);
    const result = evaluateBlocks(blocks, 1, inputs, { skip: new Set(this.issues().keys()) });
    const infos = new Map(this.values().map((v) => [v.name, v]));
    const rows: Breakdown['rows'] = [];
    let failed = false;
    for (const block of blocks) {
      const v = result.values.get(block.id)?.[0];
      if (v === undefined || (block.role === 'want' && block.weight <= 0)) continue;
      // Show the value a block reads when it reads one, e.g. "520 m"
      const compiled = compileCached(block.code, inputs.names);
      const used = compiled.ok && compiled.formula.uses.length === 1 ? compiled.formula.uses[0] : null;
      const input = used ? formatValueOf(infos.get(used)!, inputs.values(used)?.[0] ?? NaN) : '';
      if (block.role === 'must') {
        const ok = v !== 0;
        failed ||= !ok;
        rows.push({ name: block.name, value: input, result: ok ? '✓ met' : '✕ not met', failed: !ok });
      } else {
        const has = !Number.isNaN(v);
        rows.push({
          name: block.name,
          value: input || (has ? v.toFixed(2) : 'no data'),
          result: has ? `${(v * block.weight).toFixed(1)} / ${block.weight}` : `– / ${block.weight}`,
          failed: false,
        });
      }
    }
    const where = `${municipality?.name ?? ''} Kommune`;
    if (!result.hasScore) return { title: 'No score yet', subtitle: `Add something to weigh · ${where}`, rows };
    if (failed) return { title: 'Left out', subtitle: `A requirement is not met · ${where}`, rows };
    return { title: `${Math.round(result.scores[0])} points`, subtitle: `${homes} · ${where}${area}`, rows };
  }

  /** Raster cell index under a longitude/latitude, or -1. */
  cellAt(lng: number, lat: number): number {
    const grid = this.data.grid();
    const frame = this.mercator();
    if (!grid || !frame) return -1;
    const R = 6378137;
    const x = (R * lng * Math.PI) / 180;
    const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
    const col = Math.floor((x - frame.x0) / frame.pixel);
    const row = Math.floor((frame.y1 - y) / frame.pixel);
    return col >= 0 && col < grid.width && row >= 0 && row < grid.height ? row * grid.width + col : -1;
  }
}
