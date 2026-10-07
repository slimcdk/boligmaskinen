import { describe, expect, it } from 'vitest';
import { BASEMAP_FILES, MAP_COLOURS, RAMPS, Rgb, rampGradient } from './colours';

const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe('heatmap ramps', () => {
  it('has one colour per point', () => {
    expect(RAMPS.light).toHaveLength(101);
    expect(RAMPS.dark).toHaveLength(101);
  });

  it('makes more points darker on the light map and brighter on the dark map', () => {
    for (let s = 1; s <= 100; s++) {
      expect(luminance(RAMPS.light[s])).toBeLessThanOrEqual(luminance(RAMPS.light[s - 1]));
      expect(luminance(RAMPS.dark[s])).toBeGreaterThanOrEqual(luminance(RAMPS.dark[s - 1]));
    }
    expect(luminance(RAMPS.dark[100])).toBeGreaterThan(luminance(RAMPS.light[100]) * 2);
  });

  it('gives the legend the same colours as the map', () => {
    expect(rampGradient('light')).toBe('linear-gradient(90deg, rgb(254 230 206) 0%, rgb(253 174 107) 25%, rgb(241 105 19) 50%, rgb(217 72 1) 75%, rgb(127 39 4) 100%)');
    const [r, g, b] = RAMPS.dark[100];
    expect(rampGradient('dark')).toContain(`rgb(${r} ${g} ${b}) 100%`);
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
