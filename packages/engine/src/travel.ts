/**
 * Rough travel-time estimates to the user's own places.
 *
 * There is no road or public-transport network in the pilot yet, so times are
 * straight-line distance times a detour factor at a typical speed. "Train" walks
 * or cycles to the nearest station, waits, rides and walks from the station nearest
 * the place. Valhalla and OpenTripPlanner replace this when the routing service exists.
 */
import { type Grid, type TravelMode } from './types.ts';

const EARTH = 6378137;
const WALK_MIN_PER_KM = 15; // 5 km/h with a 1.25 detour factor
const BIKE_MIN_PER_KM = 4.7; // 16 km/h with a 1.25 detour factor
const CAR_MIN_PER_KM = 1.3; // 60 km/h average with a 1.3 detour factor
const CAR_FIXED_MIN = 3;
const TRAIN_MIN_PER_KM = 1.2; // about 60 km/h including stops, slightly winding track
const TRAIN_WAIT_MIN = 8;

export interface MercatorFrame {
  x0: number;
  y1: number;
  pixel: number;
  /** cos(latitude) per raster row, to turn Web Mercator metres into ground metres. */
  rowCos: Float32Array;
}

export function mercatorFrame(grid: Grid): MercatorFrame {
  const { west, east, north } = grid.meta.bounds;
  const x0 = (EARTH * west * Math.PI) / 180;
  const x1 = (EARTH * east * Math.PI) / 180;
  const y1 = EARTH * Math.log(Math.tan(Math.PI / 4 + (north * Math.PI) / 360));
  const pixel = (x1 - x0) / grid.width;
  const rowCos = new Float32Array(grid.height);
  for (let row = 0; row < grid.height; row++) {
    const y = y1 - (row + 0.5) * pixel;
    const lat = Math.atan(Math.sinh(y / EARTH));
    rowCos[row] = Math.cos(lat);
  }
  return { x0, y1, pixel, rowCos };
}

export function pixelOf(frame: MercatorFrame, grid: Grid, lng: number, lat: number): { col: number; row: number } {
  const x = (EARTH * lng * Math.PI) / 180;
  const y = EARTH * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return { col: Math.floor((x - frame.x0) / frame.pixel), row: Math.floor((frame.y1 - y) / frame.pixel) };
}

function access(metres: number): number {
  const km = metres / 1000;
  return Math.min(km * WALK_MIN_PER_KM, km * BIKE_MIN_PER_KM + 2);
}

/** Minutes from every land cell to the place, as an 8-bit layer (255 = 255 minutes or more). */
export function minutesLayer(grid: Grid, frame: MercatorFrame, lng: number, lat: number, mode: TravelMode): Uint8Array {
  const { width, height } = grid;
  const out = new Uint8Array(width * height).fill(255);
  const target = pixelOf(frame, grid, lng, lat);
  const targetCos = frame.rowCos[Math.min(height - 1, Math.max(0, target.row))];
  const station = grid.layers.station;
  const stationMetres = (raw: number) => grid.meta.distanceMax * Math.pow(raw / 255, 2);
  const inside = target.col >= 0 && target.col < width && target.row >= 0 && target.row < height;
  const egress = inside ? access(stationMetres(station[target.row * width + target.col])) : 30;

  const cells = grid.landCells;
  for (let n = 0; n < cells.length; n++) {
    const cell = cells[n];
    const row = (cell / width) | 0;
    const col = cell - row * width;
    const dx = (col - target.col) * frame.pixel;
    const dy = (row - target.row) * frame.pixel;
    const km = (Math.hypot(dx, dy) * (frame.rowCos[row] + targetCos)) / 2 / 1000;
    let minutes: number;
    switch (mode) {
      case 'car': minutes = CAR_FIXED_MIN + km * CAR_MIN_PER_KM; break;
      case 'bike': minutes = km * BIKE_MIN_PER_KM; break;
      case 'walk': minutes = km * WALK_MIN_PER_KM; break;
      case 'transit': {
        const byTrain = access(stationMetres(station[cell])) + TRAIN_WAIT_MIN + km * TRAIN_MIN_PER_KM + egress;
        minutes = Math.min(km * WALK_MIN_PER_KM, byTrain);
        break;
      }
    }
    out[cell] = Math.min(255, Math.round(minutes));
  }
  return out;
}
