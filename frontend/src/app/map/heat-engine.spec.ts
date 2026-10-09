import { describe, expect, it } from 'vitest';
import { Block, DEFAULT_VIEW, Grid, GridMeta, LayerName } from '@boligmaskinen/engine';
import { HeatEngine, HeatRequest } from './heat-engine';

const LAYERS: LayerName[] = ['forest', 'water', 'beach', 'noise', 'supermarket', 'school', 'daycare', 'station', 'turbine', 'density', 'zone', 'municipality', 'mask'];

/**
 * A 4 × 2 grid around Aarhus: six land cells, four with homes, two of sea. The forest is about
 * 0, 300, 1,650 and 3,000 m away along the top row (the raw values encode the square root), whose
 * zones are byzone, landzone, byzone and sommerhusområde.
 */
function grid(): Grid {
  const width = 4;
  const height = 2;
  const layers = Object.fromEntries(LAYERS.map((name) => [name, new Uint8Array(width * height)])) as Record<LayerName, Uint8Array>;
  const raw = (metres: number) => Math.round(Math.sqrt(metres / 20_000) * 255);
  layers.forest.set([raw(0), raw(300), raw(1650), raw(3000), raw(0), raw(0), 0, 0]);
  layers.zone.set([1, 2, 1, 3, 1, 2, 0, 0]);
  layers.municipality.set([1, 1, 1, 1, 1, 1, 0, 0]);
  layers.mask.set([3, 3, 3, 3, 1, 1, 0, 0]);
  const meta: GridMeta = {
    built: '2026-10-10', region: { id: 'aarhus', name: 'Aarhus Kommune' }, width, height, cellMetres: 100, distanceMax: 20_000,
    bounds: { west: 10.0, south: 56.0, east: 10.004, north: 56.002 }, files: {}, counts: {},
    municipalities: [{ index: 1, code: '751', name: 'Aarhus', incomeTax: 24.52, landTax: 6, population: 378_270, burglariesPer1000: 3.43 }],
    basemap: { parts: 1, chunkSize: 5_000_000, size: 0 },
  };
  return {
    meta, width, height, layers, municipalities: [undefined, meta.municipalities[0]],
    homeCells: Uint32Array.of(0, 1, 2, 3), landCells: Uint32Array.of(0, 1, 2, 3, 4, 5),
  };
}

const block = (code: string, extra: Partial<Block> = {}): Block => ({ id: extra.id ?? code, name: extra.name ?? 'Test', code, role: 'want', weight: 4, ...extra });
const request = (blocks: Block[], view: Partial<HeatRequest['view']> = {}): HeatRequest => ({
  blocks, places: [], view: { ...DEFAULT_VIEW, smooth: 0, ...view }, scheme: 'light',
});

describe('the heat engine', () => {
  it('scores the cells with homes, colours what it shows and says how the blocks do', () => {
    const engine = new HeatEngine(grid());
    const pixels = new Uint32Array(8);
    const result = engine.render(request([block('ramp(forest, 300, 3000)', { id: 'forest' })]), pixels);
    expect(result.stats).toMatchObject({ hasPreferences: true, considered: 4, shown: 4, limit: 0 });
    expect([...result.stats.histogram.entries()].filter(([, n]) => n).map(([score]) => score)).toEqual([0, 50, 100]);
    expect(result.previews).toEqual([['forest', 'Median score 1.00']]);
    expect(result.issues).toEqual([]);
    // The cells with homes are coloured; land without homes and the sea are not
    expect(Array.from(pixels, (p) => p !== 0)).toEqual([true, true, true, true, false, false, false, false]);
    // The most points are the most opaque
    expect(pixels[0] >>> 24).toBeGreaterThan(pixels[3] >>> 24);
  });

  it('leaves out cells that fail a requirement, and can show them greyed out', () => {
    const engine = new HeatEngine(grid());
    const pixels = new Uint32Array(8);
    const blocks = [block('ramp(forest, 300, 3000)'), block('zone == BYZONE', { id: 'byzone', role: 'must' })];
    const result = engine.render(request(blocks, { show: 'abs', abs: 90, showBelow: true }), pixels);
    expect(result.stats).toMatchObject({ considered: 2, shown: 1, limit: 90 });
    expect(result.previews).toContainEqual(['byzone', '50 % of the cells pass']);
    // Cell 2 scores 50, below the limit, so it is grey; cells 1 and 3 are not in byzone
    expect(pixels[2]).not.toBe(0);
    expect(pixels[2] >>> 24).toBeLessThan(pixels[0] >>> 24);
    expect([pixels[1], pixels[3]]).toEqual([0, 0]);
  });

  it('names the blocks that cannot run', () => {
    const engine = new HeatEngine(grid());
    const result = engine.render(request([block('forest / 100', { id: 'big' }), block('ramp(nothing, 1, 2)', { id: 'unknown' })]), new Uint32Array(8));
    expect(new Map(result.issues).get('big')).toMatch(/^Gives 2\.956 where forest = 296 \(3 cells\)\. A score has to be between 0 and 1/);
    expect(new Map(result.issues).get('unknown')).toMatch(/Unknown name “nothing”/);
    expect(result.stats.hasPreferences).toBe(false);
  });

  it('explains the points of a cell, and nothing outside the region', () => {
    const engine = new HeatEngine(grid());
    const blocks = [block('ramp(forest, 300, 3000)', { name: 'Forest' }), block('zone == BYZONE', { id: 'byzone', name: 'Byzone', role: 'must' })];
    engine.render(request(blocks), new Uint32Array(8));
    expect(engine.explain(0, { blocks, places: [] })).toEqual({
      title: '100 points', subtitle: 'Cell with homes · Aarhus Kommune',
      rows: [{ name: 'Forest', value: '0 m', result: '4.0 / 4', failed: false }, { name: 'Byzone', value: 'Byzone', result: '✓ met', failed: false }],
    });
    expect(engine.explain(3, { blocks, places: [] })).toMatchObject({ title: 'Left out', subtitle: 'A requirement is not met · Aarhus Kommune' });
    expect(engine.explain(6, { blocks, places: [] })).toBeNull();
    expect(engine.explain(-1, { blocks, places: [] })).toBeNull();
  });
});
