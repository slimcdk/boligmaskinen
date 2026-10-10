import { ENGLISH, formatNumber, type Wording } from './wording.ts';

export function formatDistance(metres: number, wording: Wording = ENGLISH): string {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${formatNumber(metres / 1000, wording, metres < 10000 ? 1 : 0)} km`;
}
