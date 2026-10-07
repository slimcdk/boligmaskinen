import { describe, expect, it } from 'vitest';
import { autoRange, compileFormula, formulaParams, renameValues, setParam, toVariableName } from './formula';

const run = (code: string, inputs: Record<string, number> = {}) => {
  const result = compileFormula(code, Object.keys(inputs));
  if (!result.ok) throw new Error(result.error.message);
  return result.formula.run(Object.values(inputs));
};

const error = (code: string, inputs: string[] = []) => {
  const result = compileFormula(code, inputs);
  if (result.ok) throw new Error('expected an error');
  return result.error;
};

describe('compileFormula', () => {
  it('follows the usual precedence', () => {
    expect(run('1 + 2 * 3')).toBe(7);
    expect(run('(1 + 2) * 3')).toBe(9);
    expect(run('-2 ** 2')).toBe(-4);
    expect(run('2 ** 3 ** 2')).toBe(512);
    expect(run('1 < 2 && 3 > 4 || true')).toBe(1);
    expect(run('forest < 500 ? 1 : 0.25', { forest: 800 })).toBe(0.25);
  });

  it('reads values, let lines, functions and constants', () => {
    const code = `
      // close to whichever is nearer
      let reach = 3000
      let nearest = min(forest, water);
      clamp(1 - nearest / reach)`;
    expect(run(code, { forest: 1500, water: 600 })).toBeCloseTo(0.8);
    expect(run('ramp(noise, 45, 65)', { noise: 55 })).toBeCloseTo(0.5);
    expect(run('fallback(noise, 50) / 100', { noise: NaN })).toBe(0.5);
    expect(run('known(noise)', { noise: NaN })).toBe(0);
    expect(run('zone == LANDZONE', { zone: 2 })).toBe(1);
    expect(run('choice(2, a, b, c)', { a: 10, b: 20, c: 30 })).toBe(20);
  });

  it('lets missing data spread to the result unless the answer is given anyway', () => {
    expect(run('forest / 1000', { forest: NaN })).toBeNaN();
    expect(run('noise <= 55', { noise: NaN })).toBeNaN();
    expect(run('noise <= 55 ? 1 : 0', { noise: NaN })).toBeNaN();
    expect(run('!(noise > 50)', { noise: NaN })).toBeNaN();
    expect(run('false && noise > 50', { noise: NaN })).toBe(0);
    expect(run('true || noise > 50', { noise: NaN })).toBe(1);
    expect(run('noise > 50 || forest < 100', { noise: NaN, forest: 500 })).toBeNaN();
  });

  it('only reports the values the code reads', () => {
    const result = compileFormula('ramp(forest, 300, 3000)', ['forest', 'water', 'noise']);
    expect(result.ok && result.formula.uses).toEqual(['forest']);
  });

  it('explains mistakes with a position', () => {
    expect(error('forest +', ['forest'])).toMatchObject({ line: 1, column: 9, message: 'The formula stops in the middle' });
    expect(error('forrest * 2', ['forest', 'water']).message).toBe('Unknown name “forrest”. Did you mean forest?');
    expect(error('xyz * 2', ['forest']).message).toBe('Unknown name “xyz”. See the list of values.');
    expect(error('clamp(1, 2, 3, 4)').message).toBe('clamp() takes 1 to 3 values, not 4');
    expect(error('let x = 2\nx = 3').message).toContain('Use == to compare');
    expect(error('sum(1)').message).toContain('Unknown function “sum”');
    expect(error('let forest = 1\nforest', ['forest']).message).toContain('already taken');
    expect(error('let BYZONE = 1\nBYZONE').message).toContain('already taken');
    expect(error('').message).toContain('Write a formula');
    expect(error('2 # 3')).toMatchObject({ column: 3 });
    expect(error('let t = choice(5, a, b)\nt', ['a', 'b']).message).toContain('from 1 to 2');
  });
});

describe('controls in the code', () => {
  const code = [
    'let reach = 3000',
    'let power = slider(2, 1, 4, 0.5)  // Steepness',
    'let full = slider(300, 0, 5000, 50)  // Full points up to (m)',
    'let allowed = true  // Byzone',
    'let travel = choice(2, work_car, work_bike, work_walk)  // Travel by',
    'let half = reach / 2',
    'clamp(1 - (forest / reach) ** power) * allowed',
  ].join('\n');

  it('turns plain numbers, sliders, booleans and choices into controls', () => {
    const params = formulaParams(code);
    expect(params.map((p) => [p.kind, p.name, p.label, p.unit, p.value])).toEqual([
      ['number', 'reach', 'reach', '', 3000],
      ['number', 'power', 'Steepness', '', 2],
      ['number', 'full', 'Full points up to', 'm', 300],
      ['flag', 'allowed', 'Byzone', '', 1],
      ['choice', 'travel', 'Travel by', '', 2],
    ]);
    expect(params.map((p) => [p.min, p.max, p.step])).toEqual([[0, 9000, 100], [1, 4, 0.5], [0, 5000, 50], [0, 1, 1], [1, 3, 1]]);
    expect(params[4].options).toEqual(['car', 'bike', 'walk']);
  });

  it('rewrites the value when a control changes', () => {
    const [reach, power, , allowed, travel] = formulaParams(code);
    expect(setParam(code, reach, 4250).startsWith('let reach = 4250\n')).toBe(true);
    expect(setParam(code, power, 3.5)).toContain('slider(3.5, 1, 4, 0.5)');
    expect(setParam(code, allowed, 0)).toContain('let allowed = false  // Byzone');
    expect(setParam(code, travel, 3)).toContain('choice(3, work_car');
  });

  it('finds the controls even when a value name is unknown', () => {
    expect(formulaParams('let reach = 1000\nclamp(1 - nowhere / reach)')).toHaveLength(1);
  });
});

describe('renameValues', () => {
  it('renames value names and leaves comments and other names alone', () => {
    const code = '// work_car is the commute\nlet t = choice(1, work_car, work_bike)\nramp(t, 15, 45) + work_car_extra';
    expect(renameValues(code, { work_car: 'office_car', work_bike: 'office_bike' }))
      .toBe('// work_car is the commute\nlet t = choice(1, office_car, office_bike)\nramp(t, 15, 45) + work_car_extra');
  });
});

describe('helpers', () => {
  it('picks round slider ranges', () => {
    expect(autoRange(3000)).toEqual({ min: 0, max: 9000, step: 100 });
    expect(autoRange(45)).toEqual({ min: 0, max: 140, step: 1 });
    expect(autoRange(0.4)).toEqual({ min: 0, max: 1, step: 0.01 });
  });

  it('makes names a formula can use', () => {
    expect(toVariableName('Mormor og morfar')).toBe('mormor_og_morfar');
    expect(toVariableName('Børnehave')).toBe('boernehave');
    expect(toVariableName('2nd home')).toBe('v_2nd_home');
    expect(toVariableName('min')).toBe('min_value');
  });
});
