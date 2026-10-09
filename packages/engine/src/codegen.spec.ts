import { afterEach, describe, expect, it } from 'vitest';
import { type Block, type BlockInputs, runBlock } from './blocks.ts';
import { allowGeneratedCode } from './codegen.ts';
import { compileFormula } from './formula.ts';
import { LIBRARY, placeTemplate } from './library.ts';
import { DATA_VALUES, placeValues } from './values.ts';

const PLACES = [{ id: 'p1', name: 'Work', lng: 10.2, lat: 56.15 }];
const NAMES = [...DATA_VALUES.map((v) => v.name), ...placeValues(PLACES).map((v) => v.name)];

/** Values that test the edges: missing data, zero, negatives, infinity, and ordinary numbers. */
const SPECIAL = [NaN, 0, -0, 1, -1, 0.5, 2, 45, 55, 65, 300, 3000, 1e9, Infinity, -Infinity];

/** n cells with a value for every name, the first ones from SPECIAL, the rest random. */
function cells(n: number, seed = 7): BlockInputs {
  let state = seed;
  const random = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const columns = new Map(NAMES.map((name, k) => {
    const column = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      column[i] = i < SPECIAL.length ** 2 ? SPECIAL[(k % 2 ? Math.floor(i / SPECIAL.length) : i) % SPECIAL.length] : random() < 0.1 ? NaN : random() * 8000 - 100;
    }
    return [name, column] as const;
  }));
  return { names: NAMES, values: (name) => columns.get(name) ?? null };
}

/** The block's result with the generated loop and with the closures, which must be the same. */
function both(block: Block, n: number, inputs: BlockInputs) {
  allowGeneratedCode(true);
  const generated = runBlock(block, n, inputs);
  allowGeneratedCode(false);
  const closures = runBlock(block, n, inputs);
  allowGeneratedCode(true);
  return { generated, closures };
}

const same = (a: Float32Array, b: Float32Array) => a.length === b.length && a.every((x, i) => Object.is(x, b[i]));

const FORMULAS = [
  'ramp(forest, 300, 3000)',
  'ramp(forest, 3000, 300)',
  'ramp(forest, 500, 500)',
  'clamp(forest / 1000)',
  'clamp(forest, 100)',
  'clamp(forest, 100, 2000) / 2000',
  'noise < 55 ? 1 : 0.3',
  'noise <= 55 && forest < 1000',
  'noise > 55 || !(school >= 2000)',
  'zone == BYZONE || zone != SOMMERHUS',
  'zone === 2 && known(noise)',
  'fallback(noise, 50) / 100',
  'min(forest, water, beach) / 10000',
  'max(1, forest) ** 0.5 / 100',
  'pow(abs(forest - 4000), 2) % 7 / 7',
  'sqrt(abs(forest)) / 100',
  'exp(-forest / 1000)',
  'log(1 + abs(forest)) / 20',
  'round(forest / 1000) / 10 + floor(water / 4000) / 10 + ceil(beach / 9000) / 10',
  '-(-forest) / 8000',
  '+forest / 8000',
  'let reach = slider(3000, 0, 10000, 100)\nlet near = ramp(school, 500, reach)\nnear * 0.5 + (noise > 60 ? 0 : 0.5)',
  'let byzone = true // Byzone\nlet sommerhus = false // Sommerhus\nbyzone && zone == BYZONE || sommerhus && zone == SOMMERHUS',
  'let travel = choice(2, work_car, work_bike, work_walk)\nramp(travel, 10, 60)',
  'let pick = choice(1, forest, water)\nlet other = choice(2, forest, water)\nramp(pick + other, 0, 16000)',
  'noise ? (forest ? 1 : 0.5) : (water ? 0.25 : 0)',
  'forest > 1000 ? noise > 55 ? 0.2 : 0.8 : beach < 500 ? 1 : 0',
  'income_tax / 30 + land_tax * 0',
  '2', '0.5', 'true', 'false', '1e400 > forest', '1 / 0', '0 / 0',
];

describe('blocks compiled to JavaScript', () => {
  afterEach(() => allowGeneratedCode(true));

  const n = SPECIAL.length ** 2 + 2_000;
  const inputs = cells(n);

  for (const code of FORMULAS) {
    for (const role of ['want', 'must'] as const) {
      it(`give what the closures give: ${role} ${code.replace(/\n/g, ' ⏎ ')}`, () => {
        const { generated, closures } = both({ id: 'x', name: 'X', code, role, weight: 1 }, n, inputs);
        if ('issue' in closures) {
          expect(generated).toEqual(closures);
          return;
        }
        expect('values' in generated && same(generated.values, closures.values)).toBe(true);
      });
    }
  }

  it('give what the closures give for every predefined block and a place', () => {
    const templates = [...LIBRARY, placeTemplate(PLACES[0])];
    for (const template of templates) {
      const { generated, closures } = both({ id: template.id, name: template.name, code: template.code, role: template.role, weight: 1 }, n, inputs);
      expect('values' in generated && 'values' in closures && same(generated.values, closures.values), template.id).toBe(true);
    }
  });

  it('say the same about a score outside 0–1', () => {
    const { generated, closures } = both({ id: 'x', name: 'X', code: 'forest / 1000', role: 'want', weight: 1 }, n, inputs);
    expect(generated).toEqual(closures);
    expect('issue' in generated && generated.issue).toMatch(/^Gives .* cells\)\. A score has to be between 0 and 1/);
  });

  it('copy nothing the user wrote into the code', () => {
    const code = 'let evil = 1 // "); fetch("https://example.com"); ("\n// alert(document.cookie)\nramp(forest, 300, 3000) * evil';
    const compiled = compileFormula(code, NAMES);
    expect(compiled.ok).toBe(true);
    const source = compiled.ok ? String(compiled.formula.loop) : '';
    expect(source).not.toMatch(/fetch|example|alert|cookie|evil|forest/);
    expect(source).toContain('RAMP(v0, 300, 3000)');
  });

  it('fall back to the closures where generated code is not allowed', () => {
    allowGeneratedCode(false);
    const compiled = compileFormula('ramp(forest, 300, 3000)', NAMES);
    expect(compiled.ok && compiled.formula.loop).toBeNull();
    const result = runBlock({ id: 'x', name: 'X', code: 'ramp(forest, 300, 3000)', role: 'want', weight: 1 }, 3, {
      names: NAMES, values: (name) => (name === 'forest' ? Float32Array.from([0, 1650, NaN]) : null),
    });
    expect('values' in result && Array.from(result.values)).toEqual([1, 0.5, NaN]);
  });
});
