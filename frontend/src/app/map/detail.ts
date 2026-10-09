import { DetailTiles, Grid, LayerName } from '@boligmaskinen/engine';

/** From this zoom the map shows the grid's own cells, where the data pack has detail tiles. */
export const DETAIL_ZOOM = 10;
/** More tiles than this, on a big screen at DETAIL_ZOOM, and the map keeps the region's grid. */
export const MAX_TILES = 30;

const EARTH = 6378137;
const toMercator = (lng: number, lat: number): [number, number] =>
  [(EARTH * lng * Math.PI) / 180, EARTH * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
const toLonLat = (x: number, y: number): [number, number] =>
  [((x / EARTH) * 180) / Math.PI, ((2 * Math.atan(Math.exp(y / EARTH)) - Math.PI / 2) * 180) / Math.PI];

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** A block of tiles, by their first and last column and row. */
export interface TileRange {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const sameRange = (a: TileRange | null, b: TileRange | null) =>
  a === b || (!!a && !!b && a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1);

export const tileKeys = (range: TileRange): string[] => {
  const keys: string[] = [];
  for (let y = range.y0; y <= range.y1; y++) for (let x = range.x0; x <= range.x1; x++) keys.push(`${x}-${y}`);
  return keys;
};

/** The tiles a view needs: none outside the tiles, and none when it would take more than `max`. */
export function tilesFor(tiles: DetailTiles, view: Bounds, max = MAX_TILES): TileRange | null {
  const span = tiles.size * tiles.pixel;
  const [west, north] = toMercator(view.west, view.north);
  const [east, south] = toMercator(view.east, view.south);
  const column = (x: number) => Math.floor((x - tiles.origin.x) / span);
  const row = (y: number) => Math.floor((tiles.origin.y - y) / span);
  const range = {
    x0: Math.max(0, column(west)), x1: Math.min(tiles.columns - 1, column(east)),
    y0: Math.max(0, row(north)), y1: Math.min(tiles.rows - 1, row(south)),
  };
  if (range.x0 > range.x1 || range.y0 > range.y1) return null;
  return (range.x1 - range.x0 + 1) * (range.y1 - range.y0 + 1) > max ? null : range;
}

/**
 * The grid of a block of tiles, which the heat engine draws like the region's grid. A tile that is
 * not there has no land. The region's grid gives the rest: the municipalities and the encodings.
 */
export function mosaic(region: Pick<Grid, 'meta' | 'municipalities'>, range: TileRange, tile: (key: string) => Uint8Array | undefined): Grid {
  const tiles = region.meta.tiles!;
  const size = tiles.size;
  const width = (range.x1 - range.x0 + 1) * size;
  const height = (range.y1 - range.y0 + 1) * size;
  const layers = Object.fromEntries(tiles.layers.map((name) => [name, new Uint8Array(width * height)])) as Record<LayerName, Uint8Array>;
  for (let ty = range.y0; ty <= range.y1; ty++) {
    for (let tx = range.x0; tx <= range.x1; tx++) {
      const data = tile(`${tx}-${ty}`);
      if (!data) continue;
      const left = (tx - range.x0) * size;
      const top = (ty - range.y0) * size;
      tiles.layers.forEach((name, k) => {
        const from = data.subarray(k * size * size, (k + 1) * size * size);
        for (let row = 0; row < size; row++) layers[name].set(from.subarray(row * size, (row + 1) * size), (top + row) * width + left);
      });
    }
  }
  const land: number[] = [];
  const homes: number[] = [];
  const mask = layers.mask;
  for (let cell = 0; cell < mask.length; cell++) {
    if (mask[cell] & 1) land.push(cell);
    if (mask[cell] & 2) homes.push(cell);
  }
  const span = size * tiles.pixel;
  const [west, north] = toLonLat(tiles.origin.x + range.x0 * span, tiles.origin.y - range.y0 * span);
  const [east, south] = toLonLat(tiles.origin.x + (range.x1 + 1) * span, tiles.origin.y - (range.y1 + 1) * span);
  return {
    meta: { ...region.meta, width, height, bounds: { west, south, east, north }, cellMetres: tiles.cellMetres, tiles: undefined },
    width, height, layers, municipalities: region.municipalities,
    homeCells: Uint32Array.from(homes), landCells: Uint32Array.from(land),
  };
}

/** The corners of a grid for a MapLibre canvas source: top left, top right, bottom right, bottom left. */
export function corners(grid: Pick<Grid, 'meta'>): [[number, number], [number, number], [number, number], [number, number]] {
  const b = grid.meta.bounds;
  return [[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south]];
}
