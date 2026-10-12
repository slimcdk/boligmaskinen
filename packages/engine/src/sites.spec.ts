import { describe, expect, it } from 'vitest';
import { distanceLayer, pointsOf, sitesFrom } from './sites.ts';
import { mercatorFrame, pixelOf } from './travel.ts';
import type { Grid } from './types.ts';

/** A grid over Aarhus of `width` × `height` cells of about 200 m. */
function grid(width = 60, height = 50): Grid {
  return {
    meta: { width, height, bounds: { west: 10.0, east: 10.2, north: 56.2, south: 56.1 }, distanceMax: 20000 } as Grid['meta'],
    width, height, layers: {} as Grid['layers'], municipalities: [], homeCells: new Uint32Array(), landCells: new Uint32Array(),
  };
}

const raw = (metres: number) => (metres >= 20000 ? 255 : Math.round(255 * Math.sqrt(metres / 20000)));

describe('distanceLayer', () => {
  it('gives every cell the distance to the nearest point, as a layer of distances does', () => {
    const g = grid();
    const frame = mercatorFrame(g);
    const points = [10.05, 56.15, 10.17, 56.18, 10.1, 56.12];
    const layer = distanceLayer(g, frame, points);
    const seeds = [0, 2, 4].map((i) => pixelOf(frame, g, points[i], points[i + 1]));
    for (let row = 0; row < g.height; row++) {
      for (let col = 0; col < g.width; col++) {
        const cells = Math.min(...seeds.map((s) => Math.hypot(col - s.col, row - s.row)));
        expect(layer[row * g.width + col], `cell ${col}, ${row}`).toBe(raw(cells * frame.pixel * frame.rowCos[row]));
      }
    }
    // A point's own cell is 0 m from it, and 2 km east of it is 2 km, to a cell
    const first = seeds[0];
    const cell = frame.pixel * frame.rowCos[first.row];
    expect(layer[first.row * g.width + first.col]).toBe(0);
    const east = Math.round(2000 / cell);
    expect(Math.abs(20000 * (layer[first.row * g.width + first.col + east] / 255) ** 2 - 2000)).toBeLessThan(cell);
  });

  it('leaves out points off the grid, and gives 255 without points or beyond the farthest distance', () => {
    const g = grid();
    const frame = mercatorFrame(g);
    expect(distanceLayer(g, frame, [12.0, 55.7]).every((v) => v === 255)).toBe(true);
    expect(distanceLayer(g, frame, []).every((v) => v === 255)).toBe(true);
    // A wide grid: 20 km and more from the only point is the farthest a layer holds
    const wide = grid(400, 20);
    const layer = distanceLayer(wide, mercatorFrame({ ...wide, meta: { ...wide.meta, bounds: { ...wide.meta.bounds, east: 11.4 } } }), [10.01, 56.19]);
    expect(layer[19 * 400 + 399]).toBe(255);
  });

  it('is quick enough for all of Denmark', () => {
    const g = grid(2344, 1848);
    const frame = mercatorFrame({ ...g, meta: { ...g.meta, bounds: { west: 7.6, east: 15.4, north: 57.9, south: 54.4 } } });
    const points: number[] = [];
    for (let i = 0; i < 3000; i++) points.push(8 + (i % 60) * 0.1, 54.6 + Math.floor(i / 60) * 0.06);
    const started = performance.now();
    const layer = distanceLayer({ ...g, meta: { ...g.meta, bounds: { west: 7.6, east: 15.4, north: 57.9, south: 54.4 } } }, frame, points);
    const took = performance.now() - started;
    expect(layer.length).toBe(2344 * 1848);
    expect(took).toBeLessThan(3000);
  });
});

describe('sites', () => {
  const sites = sitesFrom({ operators: ['clever', 'tesla', 'other'], points: [[10.05, 56.15, 0], [10.17, 56.18, 1], [10.1, 56.12, 0], [10.11, 56.13, 2]] });

  it('keeps the points as numbers', () => {
    expect(Array.from(sites.lonLat)).toEqual([10.05, 56.15, 10.17, 56.18, 10.1, 56.12, 10.11, 56.13]);
    expect(Array.from(sites.operator)).toEqual([0, 1, 0, 2]);
  });

  it("takes the points of some operators, or of all", () => {
    expect(Array.from(pointsOf(sites, ['clever']))).toEqual([10.05, 56.15, 10.1, 56.12]);
    expect(Array.from(pointsOf(sites, ['tesla', 'other']))).toEqual([10.17, 56.18, 10.11, 56.13]);
    expect(Array.from(pointsOf(sites, ['shell']))).toEqual([]);
    expect(pointsOf(sites, null)).toBe(sites.lonLat);
  });
});
