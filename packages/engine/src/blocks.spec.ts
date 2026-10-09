import { describe, expect, it } from 'vitest';
import { type Block, type BlockInputs, blockSummary, evaluateBlocks, newId } from './blocks.ts';
import { turnAround } from './formula.ts';
import { decodeValue, scoreCells, type ScoringItem } from './engine.ts';
import { blockFrom, criterionTemplate, LIBRARY, placeTemplate } from './library.ts';
import { type Criterion, DEFAULT_CRITERIA, type LayerName, type Municipality } from './types.ts';
import { DATA_VALUES, placeValues } from './values.ts';

/** Inputs from plain arrays, one entry per cell. */
function inputs(values: Record<string, number[]>, names = Object.keys(values)): BlockInputs {
  return { names, values: (name) => (values[name] ? Float32Array.from(values[name]) : null) };
}

const block = (code: string, extra: Partial<Block> = {}): Block => ({ id: extra.id ?? code, name: 'Test', code, role: 'want', weight: 2, ...extra });

describe('evaluateBlocks', () => {
  it('averages preferences by importance', () => {
    const result = evaluateBlocks(
      [block('ramp(a, 0, 100)', { id: 'a', weight: 3 }), block('ramp(b, 0, 100)', { id: 'b', weight: 1 })],
      2, inputs({ a: [0, 100], b: [100, 0] }),
    );
    expect(result.hasScore).toBe(true);
    expect(Array.from(result.scores)).toEqual([75, 25]);
    expect(result.histogram[75]).toBe(1);
  });

  it('leaves out cells where a requirement is false, and keeps cells without data', () => {
    const result = evaluateBlocks(
      [block('ramp(a, 0, 100)', { id: 'a' }), block('zone == BYZONE', { id: 'zone', role: 'must' })],
      3, inputs({ a: [0, 0, 0], zone: [1, 3, NaN] }),
    );
    expect(Array.from(result.scores)).toEqual([100, -1, 100]);
  });

  it('renormalises over the blocks that have data in a cell', () => {
    const result = evaluateBlocks(
      [block('ramp(a, 0, 100)', { id: 'a' }), block('ramp(noise, 45, 65)', { id: 'n' })],
      1, inputs({ a: [50], noise: [NaN] }),
    );
    expect(result.scores[0]).toBeCloseTo(50);
  });

  it('reports blocks that cannot run and leaves them out', () => {
    const result = evaluateBlocks(
      [block('a / 10', { id: 'range' }), block('nope * 2', { id: 'name' }), block('ramp(a, 0, 100)', { id: 'ok' })],
      2, inputs({ a: [0, 50] }),
    );
    expect(result.issues.get('range')).toBe('Gives 5 where a = 50 (1 cell). A score has to be between 0 and 1; wrap the formula in clamp(…), or use the block as a requirement.');
    expect(result.issues.get('name')).toBe('Line 1, column 1: Unknown name “nope”. See the list of values.');
    expect(Array.from(result.scores)).toEqual([100, 50]);
  });

  it('leaves out blocks with weight 0', () => {
    const result = evaluateBlocks([block('ramp(a, 0, 100)', { id: 'a', weight: 0 }), block('ramp(b, 0, 100)', { id: 'b' })], 1, inputs({ a: [0], b: [100] }));
    expect(result.scores[0]).toBe(0);
    expect(result.values.has('a')).toBe(false);
  });

  it('shows nothing until a preference counts', () => {
    expect(evaluateBlocks([], 2, inputs({})).hasScore).toBe(false);
    expect(evaluateBlocks([block('a > 1', { role: 'must' })], 2, inputs({ a: [0, 2] })).hasScore).toBe(false);
  });
});

describe('helpers', () => {
  it('summarises a block from its controls', () => {
    const forest = blockFrom(criterionTemplate(DEFAULT_CRITERIA.find((c) => c.id === 'forest')!));
    expect(blockSummary(forest)).toBe('Full points up to 300 m · No points from 3.0 km');
    // Turned around, it reads in the other direction, whatever the labels in the code say
    expect(blockSummary({ ...forest, code: turnAround(forest.code)! })).toBe('No points below 300 m · Full points from 3.0 km');
    expect(blockSummary(block('let full = 2000  // Full points up to (m)\nlet zero = 500  // No points from (m)\nramp(turbine, full, zero)')))
      .toBe('No points below 500 m · Full points from 2.0 km');
    const zone = blockFrom(criterionTemplate(DEFAULT_CRITERIA.find((c) => c.id === 'zone')!));
    expect(blockSummary(zone)).toBe('Only Byzone, Landzone');
    expect(blockSummary(block('// Close to the sea\nramp(water, 0, 1000)'))).toBe('Close to the sea');
  });

});

describe('the library', () => {
  it('has code that compiles against the values', () => {
    const place = { id: 'p1', name: 'Arbejde', lng: 10, lat: 56 };
    const names = [...DATA_VALUES, ...placeValues([place])].map((v) => v.name);
    for (const template of [...LIBRARY, placeTemplate(place)]) {
      const result = evaluateBlocks([blockFrom(template)], 1, { names, values: () => Float32Array.of(1) });
      expect([...result.issues.values()], template.id).toEqual([]);
    }
    expect(placeTemplate(place).code).toContain('choice(1, arbejde_car, arbejde_bike, arbejde_walk, arbejde_train)');
  });

  it('scores exactly like the original engine', () => {
    // Pseudo-random layers, so every value range and missing value occurs
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const n = 2000;
    const layers = {} as Record<LayerName, Uint8Array>;
    for (const name of ['forest', 'water', 'beach', 'noise', 'supermarket', 'school', 'daycare', 'station', 'turbine', 'density', 'zone', 'municipality', 'mask'] as LayerName[]) {
      layers[name] = Uint8Array.from({ length: n }, () => Math.floor(random() * 256));
    }
    layers.zone = Uint8Array.from({ length: n }, () => Math.floor(random() * 4));
    layers.municipality = Uint8Array.from({ length: n }, () => Math.floor(random() * 4));
    const municipalities: (Municipality | undefined)[] = [undefined, ...[24.6, 25.2, 26.1].map((tax, i) => ({
      index: i + 1, code: String(i), name: `M${i}`, incomeTax: tax, landTax: 0, population: 1, burglariesPer1000: 2 + i,
    }))];
    const ctx = { distanceMax: 20000, municipalities };
    const byId = (id: string) => DEFAULT_CRITERIA.find((c) => c.id === id)!;
    const criteria: Criterion[] = [
      ...['forest', 'noise', 'supermarket', 'density', 'incomeTax', 'zone', 'turbine'].map(byId),
      { ...byId('school'), role: 'must', zero: 2500 },
    ];
    const layerOf = (c: Pick<Criterion, 'kind' | 'layer'>) => layers[c.kind === 'municipal' ? 'municipality' : c.layer!];
    const items: ScoringItem[] = criteria.map((c) => ({
      id: c.id, kind: c.kind, role: c.role, weight: c.weight, full: c.full, zero: c.zero, allowed: c.allowed, field: c.field, layer: layerOf(c),
    }));
    const expected = scoreCells(items, Uint32Array.from({ length: n }, (_, i) => i), ctx);

    const values: BlockInputs = {
      names: DATA_VALUES.map((v) => v.name),
      values: (name) => {
        const info = DATA_VALUES.find((v) => v.name === name)!;
        const layer = layerOf(info);
        return Float32Array.from(layer, (raw) => decodeValue(info, raw, ctx) ?? NaN);
      },
    };
    const actual = evaluateBlocks(criteria.map((c) => blockFrom(criterionTemplate(c))), n, values);
    let left = 0;
    for (let i = 0; i < n; i++) {
      if (expected.scores[i] < 0) left++;
      expect(actual.scores[i], `cell ${i}`).toBeCloseTo(expected.scores[i], 3);
    }
    expect(left).toBeGreaterThan(100);
    expect(Array.from(actual.histogram)).toEqual(Array.from(expected.histogram));
  });
});

describe('opposite names', () => {
  it('names every predefined ramp block for when it is turned around', () => {
    const ramps = LIBRARY.filter((t) => turnAround(t.code) !== null && !t.id.startsWith('place:') && t.group !== 'Examples');
    expect(ramps.length).toBeGreaterThan(10);
    expect(ramps.filter((t) => !t.opposite).map((t) => t.id)).toEqual([]);
    expect(LIBRARY.find((t) => t.id === 'noise')).toMatchObject({ name: 'Quiet', opposite: 'Noisy' });
  });
});

describe('new ids', () => {
  it('are random, so maps saved from two devices never share one', () => {
    const ids = Array.from({ length: 1000 }, () => newId('map'));
    expect(new Set(ids).size).toBe(1000);
    expect(ids[0]).toMatch(/^map-[0-9a-f]{24}$/);
  });
});
