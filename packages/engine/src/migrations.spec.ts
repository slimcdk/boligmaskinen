import { describe, expect, it } from 'vitest';
import { type Block, evaluateBlocks } from './blocks.ts';
import { renameValues } from './formula.ts';
import { LANGUAGE_VERSION, type Migration, MigrationError, MIGRATIONS, upgradeBlock, upgradeCode } from './migrations.ts';

/** Migrations of a made-up future, to test how migrations are applied. */
const FUTURE: Migration[] = [
  { to: 2, description: 'ramp() is now called slope().', migrate: (code) => renameValues(code, { ramp: 'slope' }) },
  { to: 3, description: 'SOMMERHUS is now called SUMMERHOUSE.', migrate: (code) => renameValues(code, { SOMMERHUS: 'SUMMERHOUSE' }) },
];

describe('versions of the block language', () => {
  it('has a migration to every version after the first', () => {
    expect(MIGRATIONS.map((m) => m.to)).toEqual(Array.from({ length: LANGUAGE_VERSION - 1 }, (_, i) => i + 2));
  });

  it('leaves code of the current version alone', () => {
    expect(upgradeCode('ramp(forest, 300, 3000)', LANGUAGE_VERSION)).toEqual({ ok: true, code: 'ramp(forest, 300, 3000)', language: LANGUAGE_VERSION, changes: [] });
  });

  it('brings old code up a version at a time, and keeps comments and layout', () => {
    const code = '// ramp from the wood\nlet full = 300  // Full points up to (m)\nzone == SOMMERHUS ? 0 : ramp(forest, full, 3000)';
    expect(upgradeCode(code, 1, FUTURE, 3)).toEqual({
      ok: true, language: 3,
      changes: ['ramp() is now called slope().', 'SOMMERHUS is now called SUMMERHOUSE.'],
      code: '// ramp from the wood\nlet full = 300  // Full points up to (m)\nzone == SUMMERHOUSE ? 0 : slope(forest, full, 3000)',
    });
    // Code already at version 2 only goes through the last migration
    expect(upgradeCode('slope(forest, 300, 3000) * (zone != SOMMERHUS)', 2, FUTURE, 3).code).toBe('slope(forest, 300, 3000) * (zone != SUMMERHOUSE)');
  });

  it('stops where a migration cannot rewrite the code, and says why', () => {
    const strict: Migration[] = [FUTURE[0], {
      to: 3, description: 'pow() is removed; use ** instead.',
      migrate: (code) => {
        if (/\bpow\(/.test(code)) throw new MigrationError('it uses pow().');
        return code;
      },
    }];
    expect(upgradeCode('pow(ramp(forest, 300, 3000), 2)', 1, strict, 3)).toEqual({
      ok: false, language: 2, changes: ['ramp() is now called slope().'], code: 'pow(slope(forest, 300, 3000), 2)',
      problem: 'Version 3 of the block language changed this: pow() is removed; use ** instead. This block could not be changed automatically, because it uses pow(). Change the code by hand.',
    });
  });

  it('does not run code written for a newer version', () => {
    const block: Block = { id: 'b', name: 'From the future', code: 'ramp(forest, 300, 3000)', role: 'want', weight: 5, language: LANGUAGE_VERSION + 1 };
    const result = evaluateBlocks([block], 1, { names: ['forest'], values: () => Float32Array.from([100]) });
    expect(result.issues.get('b')).toBe(`This block is written for version ${LANGUAGE_VERSION + 1} of the block language, and this app knows up to version ${LANGUAGE_VERSION}. Update the app, or rewrite the block.`);
  });

  it('treats blocks saved before there were versions as version 1', () => {
    const { block, upgrade } = upgradeBlock({ id: 'b', name: 'Old', code: 'ramp(forest, 300, 3000)', role: 'want', weight: 5 }, FUTURE, 3);
    expect(upgrade.changes).toHaveLength(2);
    expect(block).toMatchObject({ code: 'slope(forest, 300, 3000)', language: 3 });
  });

  it('refuses a list of migrations with a gap', () => {
    expect(() => upgradeCode('1', 1, [FUTURE[1]], 3)).toThrow('There is no migration from version 1 to 2 of the block language');
  });
});
