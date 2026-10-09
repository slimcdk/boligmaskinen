import { describe, expect, it } from 'vitest';
import { DetailTiles, GridMeta, LayerName } from '@boligmaskinen/engine';
import { corners, MAX_TILES, mosaic, tileKeys, tilesFor } from './detail';

const EARTH = 6378137;
const LAYERS: LayerName[] = ['forest', 'zone', 'mask'];

/** Tiles of 4 × 4 cells of 100 m around Aarhus: 3 columns, 2 rows, the last one empty. */
const TILES: DetailTiles = {
  cellMetres: 100, size: 4, columns: 3, rows: 2, layers: LAYERS, available: ['0-0', '1-0', '2-0', '0-1', '1-1'],
  origin: { x: (EARTH * 10 * Math.PI) / 180, y: EARTH * Math.log(Math.tan(Math.PI / 4 + (56.2 * Math.PI) / 360)) }, pixel: 180,
};
const toLonLat = (x: number, y: number) => [((x / EARTH) * 180) / Math.PI, ((2 * Math.atan(Math.exp(y / EARTH)) - Math.PI / 2) * 180) / Math.PI];
/** The longitude and latitude of a point in tile cells from the origin. */
const at = (column: number, row: number) => toLonLat(TILES.origin.x + column * TILES.pixel, TILES.origin.y - row * TILES.pixel);
const view = (c0: number, r0: number, c1: number, r1: number) => {
  const [west, north] = at(c0, r0);
  const [east, south] = at(c1, r1);
  return { west, south, east, north };
};

describe('detail tiles', () => {
  it('finds the tiles a view needs', () => {
    expect(tilesFor(TILES, view(1, 1, 6, 3))).toEqual({ x0: 0, y0: 0, x1: 1, y1: 0 });
    expect(tilesFor(TILES, view(5, 5, 9, 7))).toEqual({ x0: 1, y0: 1, x1: 2, y1: 1 });
    // A view bigger than the tiles takes them all; one beside them takes none
    expect(tilesFor(TILES, view(-10, -10, 30, 30))).toEqual({ x0: 0, y0: 0, x1: 2, y1: 1 });
    expect(tilesFor(TILES, view(20, 1, 30, 2))).toBeNull();
    // Too many tiles, and the region's grid is enough
    expect(tilesFor({ ...TILES, columns: 100, rows: 100 }, view(0, 0, 4 * 8, 4 * 8))).toBeNull();
    expect(MAX_TILES).toBeLessThan(81);
    expect(tileKeys({ x0: 1, y0: 0, x1: 2, y1: 1 })).toEqual(['1-0', '2-0', '1-1', '2-1']);
  });

  it('puts the tiles of a range together into one grid', () => {
    /** A tile whose forest layer counts its cells, whose zone is its column and whose mask marks land and homes. */
    const tile = (column: number) => Uint8Array.from([
      ...Array.from({ length: 16 }, (_, i) => i),
      ...Array.from({ length: 16 }, () => column + 1),
      ...Array.from({ length: 16 }, (_, i) => (i < 8 ? 3 : i < 12 ? 1 : 0)),
    ]);
    const meta = { tiles: TILES, municipalities: [], bounds: { west: 0, south: 0, east: 0, north: 0 }, cellMetres: 200 } as unknown as GridMeta;
    const grid = mosaic({ meta, municipalities: [] }, { x0: 1, y0: 0, x1: 2, y1: 1 }, (key) => (key === '1-0' ? tile(1) : key === '2-0' ? tile(2) : undefined));
    expect([grid.width, grid.height, grid.meta.cellMetres]).toEqual([8, 8, 100]);
    // Row 1 of the mosaic: row 1 of tile 1-0, then row 1 of tile 2-0
    expect(Array.from(grid.layers.forest.subarray(8, 16))).toEqual([4, 5, 6, 7, 4, 5, 6, 7]);
    expect(Array.from(grid.layers.zone.subarray(0, 8))).toEqual([2, 2, 2, 2, 3, 3, 3, 3]);
    // The tiles below are not there: no land
    expect(Array.from(grid.layers.mask.subarray(32, 64)).every((v) => v === 0)).toBe(true);
    expect(grid.landCells.length).toBe(2 * 12);
    expect(grid.homeCells.length).toBe(2 * 8);
    expect(Array.from(grid.homeCells.subarray(0, 4))).toEqual([0, 1, 2, 3]);
    // Its corners are those of the tiles
    const [[west, north], , [east, south]] = corners(grid);
    expect([west, north]).toEqual(at(4, 0));
    expect(east).toBeCloseTo(at(12, 8)[0], 10);
    expect(south).toBeCloseTo(at(12, 8)[1], 10);
  });
});
