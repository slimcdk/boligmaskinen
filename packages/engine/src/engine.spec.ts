import { describe, expect, it } from 'vitest';
import { boxBlur, buildLut, decodeValue, lowerLimit, percentile, scoreCells, type ScoringItem, utility } from './engine.ts';

const ctx = { distanceMax: 20000, municipalities: [] };

function item(overrides: Partial<ScoringItem>): ScoringItem {
  return { id: 'x', kind: 'count', role: 'want', weight: 1, full: 0, zero: 100, layer: new Uint8Array(1), ...overrides };
}

describe('utility', () => {
  it('gives full points at the full value and none at the zero value when closer is better', () => {
    expect(utility(300, 3000, 300)).toBe(1);
    expect(utility(300, 3000, 3000)).toBe(0);
    expect(utility(300, 3000, 1650)).toBeCloseTo(0.5);
  });

  it('works in the other direction when further is better', () => {
    expect(utility(2000, 500, 2500)).toBe(1);
    expect(utility(2000, 500, 400)).toBe(0);
    expect(utility(2000, 500, 1250)).toBeCloseTo(0.5);
  });
});

describe('decodeValue', () => {
  it('decodes distances with the square-root encoding', () => {
    expect(decodeValue({ kind: 'distance' }, 255, ctx)).toBe(20000);
    expect(decodeValue({ kind: 'distance' }, 0, ctx)).toBe(0);
  });

  it('treats noise 0 as missing and strips the source flag', () => {
    expect(decodeValue({ kind: 'noise' }, 0, ctx)).toBeNull();
    expect(decodeValue({ kind: 'noise' }, 162, ctx)).toBe(62);
    expect(decodeValue({ kind: 'noise' }, 53, ctx)).toBe(53);
    // Concentrations: 0 is no data, then steps of 1/4 µg/m³ for NO₂ and 1/10 for PM2.5
    expect(decodeValue({ kind: 'concentration', layerName: 'no2' }, 0, ctx)).toBeNull();
    expect(decodeValue({ kind: 'concentration', layerName: 'no2' }, 41, ctx)).toBe(10);
    expect(decodeValue({ kind: 'concentration', layer: 'pm25' }, 56, ctx)).toBe(5.5);
  });
});

describe('buildLut', () => {
  it('lets missing values pass requirements and leaves them out of the weight', () => {
    const lut = buildLut(item({ kind: 'noise', full: 45, zero: 65 }), ctx);
    expect(lut.pass[0]).toBe(1);
    expect(lut.available[0]).toBe(0);
    expect(lut.available[50]).toBe(1);
  });

  it('allows only the chosen categories', () => {
    const lut = buildLut(item({ kind: 'category', role: 'must', allowed: [1, 2] }), ctx);
    expect([lut.pass[1], lut.pass[2], lut.pass[3]]).toEqual([1, 1, 0]);
  });
});

describe('scoreCells', () => {
  it('weights criteria and removes cells that fail a requirement', () => {
    const near = item({ id: 'near', weight: 3, full: 0, zero: 100, layer: Uint8Array.from([0, 100, 0]) });
    const quiet = item({ id: 'quiet', weight: 1, full: 0, zero: 100, layer: Uint8Array.from([100, 0, 0]) });
    const zone = item({ id: 'zone', kind: 'category', role: 'must', allowed: [1], layer: Uint8Array.from([1, 1, 2]) });
    const { scores, histogram } = scoreCells([near, quiet, zone], Uint32Array.from([0, 1, 2]), ctx);
    expect(scores[0]).toBeCloseTo(75); // 3 of 4 weight
    expect(scores[1]).toBeCloseTo(25);
    expect(scores[2]).toBe(-1);
    expect(histogram[75] + histogram[25]).toBe(2);
  });

  it('gives every cell 100 when nothing is preferred', () => {
    const { scores } = scoreCells([], Uint32Array.from([0, 1]), ctx);
    expect(Array.from(scores)).toEqual([100, 100]);
  });
});

describe('lowerLimit and percentile', () => {
  const histogram = new Uint32Array(101);
  histogram[10] = 50;
  histogram[60] = 30;
  histogram[90] = 20;

  it('keeps the best X % of cells', () => {
    expect(lowerLimit(histogram, { show: 'top', top: 20, abs: 0 })).toBe(90);
    expect(lowerLimit(histogram, { show: 'top', top: 50, abs: 0 })).toBe(60);
  });

  it('returns the fixed limit or 0 for all', () => {
    expect(lowerLimit(histogram, { show: 'abs', top: 0, abs: 70 })).toBe(70);
    expect(lowerLimit(histogram, { show: 'all', top: 0, abs: 70 })).toBe(0);
  });

  it('finds the median', () => {
    expect(percentile(histogram, 0.5)).toBe(10);
    expect(percentile(histogram, 0.8)).toBe(60);
  });
});

describe('boxBlur', () => {
  it('preserves a constant field and spreads a single value', () => {
    const w = 9, h = 9, n = w * h;
    const ones = new Float32Array(n).fill(1);
    const out = new Float32Array(n), tmp = new Float32Array(n), col = new Float32Array(w);
    boxBlur(ones, out, tmp, col, w, h, 2);
    expect(out[40]).toBeCloseTo(1);

    const spike = new Float32Array(n);
    spike[40] = 1;
    boxBlur(spike, out, tmp, col, w, h, 1);
    const sum = out.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(out[40]).toBeGreaterThan(out[41]);
  });
});
