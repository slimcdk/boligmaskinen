import { describe, expect, it } from 'vitest';
import { type Block } from './blocks.ts';
import { blockSql, weightingSql } from './sql.ts';

const columns = { forest: 'h.forest', noise: 'h.noise', zone: 'h.zone' };
const block = (code: string, role: Block['role'] = 'want'): Block => ({ id: 'b', name: 'B', code, role, weight: 4 });

describe('blocks in SQL', () => {
  it('builds the SQL from the parsed formula alone', () => {
    const sql = blockSql(block('// Quiet near the forest, said “Robert\'); DROP TABLE homes;--”\nlet secret_name = slider(300, 0, 3000, 10)\nramp(forest, secret_name, 3000)'), columns);
    expect('issue' in sql).toBe(false);
    const text = JSON.stringify(sql);
    // The columns the caller gave, numbers, and nothing the user wrote
    expect(text).toContain('h.forest');
    expect(text).toContain('(300)::float8');
    expect(text).not.toMatch(/secret_name|DROP|Robert|Quiet/);
  });

  it('writes numbers as floats, so no division is between whole numbers', () => {
    const sql = blockSql(block('clamp(1 / 2 + forest * 1e-7 - 0.25)'), columns);
    expect(JSON.stringify(sql)).toMatch(/\(1\)::float8.*\(2\)::float8.*\(1e-7\)::float8/);
  });

  it('says why a block cannot run, as the browser does', () => {
    expect(blockSql(block('clamp(forrest / 1000)'), columns)).toEqual({ issue: expect.stringMatching(/^Line 1, column 7: Unknown name “forrest”/) });
    expect(blockSql(block('ramp(forest, 1)'), columns)).toEqual({ issue: expect.stringContaining('ramp() takes 3 values, not 2') });
  });

  it('turns a requirement into 1 and 0, and leaves the points to the preferences', () => {
    const must = blockSql(block('zone == BYZONE', 'must'), columns);
    expect(must).toMatchObject({ outside: 'false', value: expect.stringContaining('THEN 1::float8 ELSE 0::float8') });
    expect(weightingSql([block('zone == BYZONE', 'must')], columns).points).toBeNull();
    expect(weightingSql([block('ramp(forest, 300, 3000)'), block('zone == BYZONE', 'must')], columns).points).toMatch(/^\(CASE WHEN \(.*\) = 0 THEN NULL::float8 ELSE/);
  });
});
