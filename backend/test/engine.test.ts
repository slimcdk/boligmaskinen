import { blockFrom, evaluateBlocks, LIBRARY } from '@boligmaskinen/engine';
import { describe, expect, it } from 'vitest';

describe('the shared engine', () => {
  it('scores cells in the backend exactly as in the browser', () => {
    const forest = blockFrom(LIBRARY.find((t) => t.id === 'forest')!);
    // Three cells: 100 m, 1 km and 5 km from a wood, and one without data
    const distances = Float32Array.from([100, 1000, 5000, NaN]);
    const result = evaluateBlocks([forest], 4, { names: ['forest'], values: (name) => (name === 'forest' ? distances : null) });
    expect(Array.from(result.scores, (s) => Math.round(s))).toEqual([100, 74, 0, 100]);
  });
});
