import type { Scheme } from '../theme/theme.service';

export type Rgb = [number, number, number];

/**
 * Heatmap ramps from the fewest to the most points. On the light map more points read as darker
 * orange, on the dark map as brighter, so the best places stand out on both.
 */
const RAMP_STOPS: Record<Scheme, [number, Rgb][]> = {
  light: [[0, [254, 230, 206]], [25, [253, 174, 107]], [50, [241, 105, 19]], [75, [217, 72, 1]], [100, [127, 39, 4]]],
  dark: [[0, [84, 28, 6]], [25, [166, 54, 3]], [50, [236, 96, 18]], [75, [253, 150, 62]], [100, [255, 214, 130]]],
};

function interpolate(stops: [number, Rgb][]): Rgb[] {
  const out: Rgb[] = [];
  for (let s = 0; s <= 100; s++) {
    let j = 0;
    while (j < stops.length - 2 && s > stops[j + 1][0]) j++;
    const [s0, c0] = stops[j];
    const [s1, c1] = stops[j + 1];
    const t = (s - s0) / (s1 - s0);
    out.push([0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * t)) as Rgb);
  }
  return out;
}

/** The ramps in 101 steps, one per point. */
export const RAMPS: Record<Scheme, Rgb[]> = { light: interpolate(RAMP_STOPS.light), dark: interpolate(RAMP_STOPS.dark) };

/** The ramp as a CSS gradient, for the legend. */
export function rampGradient(scheme: Scheme): string {
  return `linear-gradient(90deg, ${RAMP_STOPS[scheme].map(([at, [r, g, b]]) => `rgb(${r} ${g} ${b}) ${at}%`).join(', ')})`;
}

/** Cells under the lower limit: a grey veil (alpha 0–255) that mutes them on either map. */
export const BELOW_LIMIT: Record<Scheme, { rgb: Rgb; alpha: number }> = {
  light: { rgb: [125, 129, 133], alpha: 90 },
  dark: { rgb: [150, 156, 164], alpha: 70 },
};

/** Colours of the layers the app adds to the basemap, after the Protomaps flavour of the same name. */
export interface MapColours {
  earth: string;
  water: string;
  boundaries: string;
  placeLabel: string;
  countryLabel: string;
  municipalities: string;
}

export const MAP_COLOURS: Record<Scheme, MapColours> = {
  light: { earth: '#e2dfda', water: '#80deea', boundaries: '#adadad', placeLabel: '#5c5c5c', countryLabel: '#8a8a8a', municipalities: '#3b4046' },
  dark: { earth: '#1f1f1f', water: '#31353f', boundaries: '#5b6374', placeLabel: '#8c8c8c', countryLabel: '#6e6e6e', municipalities: '#c4cad3' },
};

/** The basemap's style layers and icons per scheme: the Protomaps "light" and "dark" flavours. */
export const BASEMAP_FILES: Record<Scheme, { layers: string; sprite: string }> = {
  light: { layers: 'style-layers.json', sprite: 'sprites/light' },
  dark: { layers: 'style-layers-dark.json', sprite: 'sprites/dark' },
};
