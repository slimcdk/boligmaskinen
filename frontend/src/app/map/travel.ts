import { Grid, mercatorFrame, TravelMode } from '@boligmaskinen/engine';

/** The modes the road network has travel times for; a train is still an estimate. */
export const ROUTED_MODES = ['car', 'bike', 'walk'] as const satisfies readonly TravelMode[];
export type RoutedMode = (typeof ROUTED_MODES)[number];

/** Minutes to a place from every cell of the region's grid, by mode (255 for 254 or more). */
export type RoutedTimes = Record<RoutedMode, Uint8Array>;

/** A place's position as the heat engine names it: its travel times belong to the position. */
export const positionOf = (place: { lng: number; lat: number }) => `${place.lng.toFixed(5)},${place.lat.toFixed(5)}`;

/**
 * A layer of one grid on another: every cell takes the value of the cell of `from` under its
 * centre, or 255 outside it. Both are Web Mercator grids, so each column and row maps on its own.
 */
export function resample(from: Pick<Grid, 'width' | 'height' | 'meta'>, to: Pick<Grid, 'width' | 'height' | 'meta'>, layer: Uint8Array): Uint8Array {
  const source = mercatorFrame(from as Grid);
  const target = mercatorFrame(to as Grid);
  const cols = Int32Array.from({ length: to.width }, (_, col) => Math.floor((target.x0 + (col + 0.5) * target.pixel - source.x0) / source.pixel));
  const rows = Int32Array.from({ length: to.height }, (_, row) => Math.floor((source.y1 - (target.y1 - (row + 0.5) * target.pixel)) / source.pixel));
  const out = new Uint8Array(to.width * to.height).fill(255);
  for (let row = 0; row < to.height; row++) {
    const fromRow = rows[row];
    if (fromRow < 0 || fromRow >= from.height) continue;
    for (let col = 0; col < to.width; col++) {
      const fromCol = cols[col];
      if (fromCol >= 0 && fromCol < from.width) out[row * to.width + col] = layer[fromRow * from.width + fromCol];
    }
  }
  return out;
}
