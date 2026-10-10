import { describe, expect, it } from 'vitest';
import { GridMeta } from '@boligmaskinen/engine';
import { positionOf, resample } from './travel';

const EARTH = 6378137;
const toLng = (x: number) => ((x / EARTH) * 180) / Math.PI;
const toLat = (y: number) => ((2 * Math.atan(Math.exp(y / EARTH)) - Math.PI / 2) * 180) / Math.PI;

/** A Web Mercator grid of `width` × `height` cells of `pixel` metres, from (x0, y1) at its top left. */
function grid(x0: number, y1: number, pixel: number, width: number, height: number) {
  const bounds = { west: toLng(x0), east: toLng(x0 + width * pixel), north: toLat(y1), south: toLat(y1 - height * pixel) };
  return { width, height, meta: { bounds } as GridMeta };
}

describe('travel times on another grid', () => {
  it('gives every cell the value of the cell under its centre', () => {
    const x0 = 1_113_195;
    const y1 = 7_560_000;
    // The region's cells of 360 m, and a detail grid of 180 m that starts one region cell in
    const region = grid(x0, y1, 360, 4, 3);
    const detail = grid(x0 + 360, y1 - 360, 180, 8, 6);
    const layer = Uint8Array.from({ length: 12 }, (_, i) => 10 + i);
    const out = resample(region, detail, layer);
    // Two detail cells a region cell, in both directions
    expect(Array.from(out.subarray(0, 8))).toEqual([15, 15, 16, 16, 17, 17, 255, 255]);
    expect(Array.from(out.subarray(16, 24))).toEqual([19, 19, 20, 20, 21, 21, 255, 255]);
    // Below the region there is nothing
    expect(Array.from(out.subarray(32, 48)).every((v) => v === 255)).toBe(true);
  });

  it('names a place by its position to five decimals', () => {
    expect(positionOf({ lng: 10.203912345, lat: 56.15 })).toBe('10.20391,56.15000');
  });
});
