/**
 * Points whose distances the browser finds itself, rather than layers the data pack carries: the
 * public chargers for electric cars, so a block can choose whose chargers count. The grid step
 * writes them (chargers.json); the distance from every cell to the nearest of the chosen ones is
 * worked out on the grid when a block first reads it, on the square-root scale of the layers of
 * distances.
 */
import { type MercatorFrame, pixelOf } from './travel.ts';
import type { Grid } from './types.ts';

/** A file of points, as the grid step writes it. */
export interface SitesFile {
  /** The operators' ids; a point names its operator by its index. */
  operators: string[];
  points: [lon: number, lat: number, operator: number][];
}

/** The points of a file, ready to measure distances to. */
export interface Sites {
  operators: string[];
  /** Longitude and latitude of each point, one after the other. */
  lonLat: Float64Array;
  /** Each point's operator, as an index into `operators`. */
  operator: Uint8Array;
}

export function sitesFrom(file: SitesFile): Sites {
  const lonLat = new Float64Array(file.points.length * 2);
  const operator = new Uint8Array(file.points.length);
  file.points.forEach(([lon, lat, index], i) => {
    lonLat[2 * i] = lon;
    lonLat[2 * i + 1] = lat;
    operator[i] = index;
  });
  return { operators: file.operators, lonLat, operator };
}

/**
 * The operators of public chargers a block can choose, by the ids the grid step gives them
 * (CHARGER_OPERATORS in pipeline/…/grid.py); the chargers of every other operator are "other".
 */
export const CHARGER_OPERATORS: { id: string; name: string }[] = [
  { id: 'clever', name: 'Clever' }, { id: 'norlys', name: 'Norlys' }, { id: 'ok', name: 'OK' }, { id: 'spirii', name: 'Spirii' },
  { id: 'ewii', name: 'EWII' }, { id: 'eon', name: 'E.ON' }, { id: 'tesla', name: 'Tesla' }, { id: 'circle_k', name: 'Circle K' },
  { id: 'uno_x', name: 'Uno-X' }, { id: 'shell', name: 'Shell' }, { id: 'q8', name: 'Q8' },
];

/** The points of the given operators, or of every operator. */
export function pointsOf(sites: Sites, operators: string[] | null): Float64Array {
  if (!operators) return sites.lonLat;
  const wanted = new Set(operators.map((id) => sites.operators.indexOf(id)).filter((index) => index >= 0));
  const out: number[] = [];
  for (let i = 0; i < sites.operator.length; i++) {
    if (wanted.has(sites.operator[i])) out.push(sites.lonLat[2 * i], sites.lonLat[2 * i + 1]);
  }
  return Float64Array.from(out);
}

const NONE = 0xffff;
let rowsScratch = new Uint16Array(0);

/** Space for the rows to the nearest point down each column, all NONE; distanceLayer leaves it so. */
function scratch(cells: number): Uint16Array {
  if (rowsScratch.length !== cells) rowsScratch = new Uint16Array(cells).fill(NONE);
  return rowsScratch;
}

/**
 * The distance from every cell of a grid to the nearest of the points, as a layer of distances:
 * raw = 255 × √(metres / distanceMax), 255 at distanceMax or farther, and where there are no points.
 * Points outside the grid do not count. The distance is exact between cell centres, in Web
 * Mercator cells scaled to the ground at the cell's latitude.
 *
 * It is the distance transform of Felzenszwalb and Huttenlocher (2012), kept to the cells within
 * distanceMax of a point: down each column the distance to its nearest point, then along each row
 * the lower envelope of those, which is the nearest point of all. A row with no point near it is
 * passed over, so the chargers of a small operator take a few milliseconds for all of Denmark.
 */
export function distanceLayer(grid: Grid, frame: MercatorFrame, lonLat: ArrayLike<number>): Uint8Array {
  const { width, height } = grid;
  const out = new Uint8Array(width * height).fill(255);
  const max = grid.meta.distanceMax;
  // The most cells a distance that counts spans: on the row nearest the pole, where cells are smallest
  const reach = Math.ceil(max / (frame.pixel * Math.min(...frame.rowCos))) + 1;
  // Down each column: the rows to the nearest point in it, where that is within reach; and per row,
  // the first and last column that has one
  const rows = scratch(width * height);
  const first = new Int32Array(height).fill(width);
  const last = new Int32Array(height).fill(-1);
  let points = 0;
  for (let i = 0; i + 1 < lonLat.length; i += 2) {
    const { col, row } = pixelOf(frame, grid, lonLat[i], lonLat[i + 1]);
    if (col < 0 || col >= width || row < 0 || row >= height) continue;
    points++;
    for (let r = Math.max(0, row - reach), end = Math.min(height - 1, row + reach); r <= end; r++) {
      const cell = r * width + col;
      const away = Math.abs(r - row);
      if (away < rows[cell]) rows[cell] = away;
      if (col < first[r]) first[r] = col;
      if (col > last[r]) last[r] = col;
    }
  }
  if (!points) return out;

  // Along each row: the lower envelope of the parabolas (q - column)² + rows², one per column with a
  // point within reach; `v` holds their columns, `f` their rows², and `z` where each takes over
  const v = new Int32Array(width);
  const f = new Float64Array(width);
  const z = new Float64Array(width + 1);
  for (let row = 0; row < height; row++) {
    if (last[row] < 0) continue;
    const start = row * width;
    let k = -1;
    for (let q = first[row]; q <= last[row]; q++) {
      const away = rows[start + q];
      if (away === NONE) continue;
      rows[start + q] = NONE;
      const fq = away * away;
      let s = -Infinity;
      while (k >= 0) {
        s = (fq + q * q - (f[k] + v[k] * v[k])) / (2 * (q - v[k]));
        if (s > z[k]) break;
        k--;
      }
      k++;
      v[k] = q;
      f[k] = fq;
      z[k] = k === 0 ? -Infinity : s;
      z[k + 1] = Infinity;
    }
    const metresPerCell = frame.pixel * frame.rowCos[row];
    for (let q = Math.max(0, first[row] - reach), j = 0, end = Math.min(width - 1, last[row] + reach); q <= end; q++) {
      while (z[j + 1] < q) j++;
      const metres = Math.sqrt((q - v[j]) * (q - v[j]) + f[j]) * metresPerCell;
      if (metres < max) out[start + q] = Math.round(255 * Math.sqrt(metres / max));
    }
  }
  return out;
}
