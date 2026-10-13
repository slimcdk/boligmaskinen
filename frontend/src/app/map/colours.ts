import type { HeatPalette, ViewState } from '@boligmaskinen/engine';
import type { Scheme } from '../theme/theme.service';
import { M3_TONES } from './m3-tones';

export type Rgb = [number, number, number];

/** A colour scale for the heatmap, from the fewest to the most points, per light and dark map. */
export interface Palette {
  id: HeatPalette;
  name: string;
  /** Said next to the name, e.g. for colour blindness. */
  note?: string;
  /** Darker with more points on the light map, brighter on the dark map. False for "Red to green". */
  sequential: boolean;
  stops: Record<Scheme, string[]>;
}

/** A tonal ramp: light to dark tones on the light map, dark to light on the dark map. */
const tonal = (tones: { 25: string; 40: string; 60: string; 80: string; 90: string }): Record<Scheme, string[]> => ({
  light: [tones[90], tones[80], tones[60], tones[40], tones[25]],
  dark: [tones[25], tones[40], tones[60], tones[80], tones[90]],
});

/**
 * The heatmap's colour scales, the default first: red for few points to green for many, made from the
 * tones of Angular Material's M3 palettes like the rest. The others are one hue each in steps of
 * lightness, which every kind of colour vision can read: more points are darker on the light map and
 * brighter on the dark map. Orange is the theme's tertiary colour and Azure its primary.
 */
export const PALETTES: Palette[] = [
  {
    id: 'red-green', name: 'Red to green', note: 'Hard to read with red-green colour blindness', sequential: false,
    stops: {
      light: [M3_TONES.red[40], M3_TONES.orange[60], M3_TONES.yellow[80], M3_TONES.green[60], M3_TONES.green[40]],
      dark: [M3_TONES.red[60], M3_TONES.orange[60], M3_TONES.yellow[80], M3_TONES.green[60], M3_TONES.green[60]],
    },
  },
  { id: 'orange', name: 'Orange', sequential: true, stops: tonal(M3_TONES.orange) },
  { id: 'azure', name: 'Azure', sequential: true, stops: tonal(M3_TONES.azure) },
  { id: 'violet', name: 'Violet', sequential: true, stops: tonal(M3_TONES.violet) },
  { id: 'rose', name: 'Rose', sequential: true, stops: tonal(M3_TONES.rose) },
];

/** How many steps "Steps" divides the scale into. */
export const STEPS = 5;

const hex = (colour: string): Rgb => [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16)) as Rgb;
const paletteOf = (id: HeatPalette): Palette => PALETTES.find((p) => p.id === id) ?? PALETTES[0];

/** Evenly spaced stops, interpolated to 101 colours, one per point. */
function interpolate(stops: Rgb[]): Rgb[] {
  const out: Rgb[] = [];
  const last = stops.length - 1;
  for (let s = 0; s <= 100; s++) {
    const at = (s / 100) * last;
    const j = Math.min(last - 1, Math.floor(at));
    const t = at - j;
    out.push([0, 1, 2].map((k) => Math.round(stops[j][k] + (stops[j + 1][k] - stops[j][k]) * t)) as Rgb);
  }
  return out;
}

/** Where a 0–1 position lands with steps: the middle of its step. */
export function stepped(t: number, bands: ViewState['bands']): number {
  if (bands !== 'steps') return t;
  return (Math.min(STEPS - 1, Math.floor(t * STEPS)) + 0.5) / STEPS;
}

const cache = new Map<string, Rgb[]>();

/**
 * The colour scale in 101 colours, one per point, for a palette, a light or dark map and smooth
 * or stepped bands. With steps, every point in a step gets the colour of the step's middle.
 */
export function rampOf(palette: HeatPalette, scheme: Scheme, bands: ViewState['bands'] = 'smooth'): Rgb[] {
  const key = `${palette}|${scheme}|${bands}`;
  let ramp = cache.get(key);
  if (!ramp) {
    const smooth = interpolate(paletteOf(palette).stops[scheme].map(hex));
    ramp = bands === 'steps' ? smooth.map((_, s) => smooth[Math.round(stepped(s / 100, bands) * 100)]) : smooth;
    cache.set(key, ramp);
  }
  return ramp;
}

/** The scale as a CSS gradient, for the colour choices; steps have hard edges. */
export function rampGradient(palette: HeatPalette, scheme: Scheme, bands: ViewState['bands'] = 'smooth'): string {
  const rgb = ([r, g, b]: Rgb) => `rgb(${r} ${g} ${b})`;
  if (bands === 'steps') {
    const ramp = rampOf(palette, scheme, 'steps');
    const parts = Array.from({ length: STEPS }, (_, i) => {
      const colour = rgb(ramp[Math.round(((i + 0.5) / STEPS) * 100)]);
      return `${colour} ${(i * 100) / STEPS}% ${((i + 1) * 100) / STEPS}%`;
    });
    return `linear-gradient(90deg, ${parts.join(', ')})`;
  }
  const stops = paletteOf(palette).stops[scheme];
  return `linear-gradient(90deg, ${stops.map((c, i) => `${rgb(hex(c))} ${(i * 100) / (stops.length - 1)}%`).join(', ')})`;
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
  /** The terrain's shading: the slopes away from the light, and those towards it. */
  shadow: string;
  highlight: string;
}

export const MAP_COLOURS: Record<Scheme, MapColours> = {
  light: {
    earth: '#e2dfda', water: '#80deea', boundaries: '#adadad', placeLabel: '#5c5c5c', countryLabel: '#8a8a8a', municipalities: '#3b4046',
    shadow: 'rgba(52, 44, 36, 0.75)', highlight: 'rgba(255, 255, 255, 0.5)',
  },
  dark: {
    earth: '#1f1f1f', water: '#31353f', boundaries: '#5b6374', placeLabel: '#8c8c8c', countryLabel: '#6e6e6e', municipalities: '#c4cad3',
    shadow: 'rgba(0, 0, 0, 0.85)', highlight: 'rgba(255, 255, 255, 0.3)',
  },
};

/** The basemap's style layers and icons per scheme: the Protomaps "light" and "dark" flavours. */
export const BASEMAP_FILES: Record<Scheme, { layers: string; sprite: string }> = {
  light: { layers: 'style-layers.json', sprite: 'sprites/light' },
  dark: { layers: 'style-layers-dark.json', sprite: 'sprites/dark' },
};
