import { describe, expect, it } from 'vitest';
import { BASEMAP_FILES, MAP_COLOURS, PALETTES, rampGradient, rampOf, Rgb, stepped, STEPS } from './colours';
import { M3_TONES } from './m3-tones';

const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const hex = (colour: string): Rgb => [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16)) as Rgb;

describe('heatmap colour scales', () => {
  it('has one colour per point for every scale, map and band setting', () => {
    for (const p of PALETTES) {
      for (const scheme of ['light', 'dark'] as const) {
        expect(rampOf(p.id, scheme)).toHaveLength(101);
        expect(rampOf(p.id, scheme, 'steps')).toHaveLength(101);
      }
    }
  });

  it('makes more points darker on the light map and brighter on the dark map, for the tonal scales', () => {
    for (const p of PALETTES.filter((q) => q.sequential)) {
      const light = rampOf(p.id, 'light');
      const dark = rampOf(p.id, 'dark');
      for (let s = 1; s <= 100; s++) {
        expect(luminance(light[s]), `${p.id} light at ${s}`).toBeLessThanOrEqual(luminance(light[s - 1]));
        expect(luminance(dark[s]), `${p.id} dark at ${s}`).toBeGreaterThanOrEqual(luminance(dark[s - 1]));
      }
    }
  });

  it('is made from the tones of Angular Material\'s M3 palettes', () => {
    expect(rampOf('orange', 'light')[0]).toEqual(hex(M3_TONES.orange[90]));
    expect(rampOf('orange', 'light')[100]).toEqual(hex(M3_TONES.orange[25]));
    expect(rampOf('azure', 'dark')[100]).toEqual(hex(M3_TONES.azure[90]));
  });

  it('gives each of the five steps one colour, the colour of its middle', () => {
    expect([0, 0.19, 0.2, 0.5, 0.99, 1].map((t) => stepped(t, 'steps'))).toEqual([0.1, 0.1, 0.3, 0.5, 0.9, 0.9]);
    expect(stepped(0.37, 'smooth')).toBe(0.37);
    const steps = rampOf('azure', 'light', 'steps');
    expect(new Set(steps.map((c) => c.join())).size).toBe(STEPS);
    expect(steps[0]).toEqual(rampOf('azure', 'light')[10]);
  });

  it('gives the legend the same colours as the map, with hard edges between steps', () => {
    const [r, g, b] = hex(M3_TONES.orange[90]);
    expect(rampGradient('orange', 'light')).toMatch(new RegExp(`^linear-gradient\\(90deg, rgb\\(${r} ${g} ${b}\\) 0%, `));
    expect(rampGradient('orange', 'light', 'steps').match(/% \d+%/g)).toHaveLength(STEPS);
  });
});

describe('map colours', () => {
  it('keeps land and water light in light mode and dark in dark mode', () => {
    const hex = (colour: string): Rgb => [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16)) as Rgb;
    expect(luminance(hex(MAP_COLOURS.light.earth))).toBeGreaterThan(150);
    expect(luminance(hex(MAP_COLOURS.dark.earth))).toBeLessThan(60);
    expect(luminance(hex(MAP_COLOURS.dark.water))).toBeLessThan(80);
  });

  it('uses the flavour files of the same scheme', () => {
    expect(BASEMAP_FILES.light).toEqual({ layers: 'style-layers.json', sprite: 'sprites/light' });
    expect(BASEMAP_FILES.dark).toEqual({ layers: 'style-layers-dark.json', sprite: 'sprites/dark' });
  });
});
