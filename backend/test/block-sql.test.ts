import { type Block, DATA_VALUES, evaluateBlocks, LIBRARY, runBlock, weightingSql } from '@boligmaskinen/engine';
import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createTestDatabase, describeWithDatabase } from './database.ts';

/** Rows of made-up values, about one in ten missing, as the browser holds them: 32-bit floats. */
const ROWS = 2_000;
const NAMES = DATA_VALUES.map((v) => v.name);

function randomValues(seed: number): Record<string, Float32Array> {
  let state = seed;
  const random = () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
  const ranges: Record<string, [number, number]> = { distance: [0, 20_000], noise: [30, 80], count: [0, 255], category: [1, 3], minutes: [0, 255], scaled: [0, 25], municipal: [0, 30] };
  return Object.fromEntries(DATA_VALUES.map((info) => {
    const [lo, hi] = ranges[info.kind] ?? [0, 100];
    const whole = info.kind === 'category' || info.kind === 'count';
    const column = Float32Array.from({ length: ROWS }, () => {
      if (random() < 0.1) return NaN;
      const v = lo + random() * (hi - lo);
      return whole ? Math.round(v) : v;
    });
    // Edges the formulas treat specially: zero, and the ends of a ramp
    column[0] = 0;
    column[1] = info.kind === 'distance' ? 300 : column[1];
    return [info.name, column];
  }));
}

const block = (id: string, code: string, role: Block['role'] = 'want', weight = 3): Block => ({ id, name: id, code, role, weight });

/** Every operator and function, with the cases where JavaScript and PostgreSQL part ways if one is careless. */
const BLOCKS: Block[] = [
  block('arithmetic', 'clamp((forest + water) / 40000 - supermarket * 0.00001 + 0.2)'),
  block('divide-by-zero', 'let d = density - density\nclamp(known(forest / d) * 0.5 + fallback(0 / d, 0.25))'),
  block('remainder', 'clamp((density % 7) / 7)'),
  block('power', 'clamp(pow(forest / 20000, 0.5) * 0.5 + (water / 20000) ** 2 * 0.5)'),
  block('negative-power', 'let x = -forest / 20000 - 0.1\nclamp(fallback(pow(x, 0.5), 0.3) + known(x ** 2) * 0.1)'),
  block('roots-and-logs', 'clamp(fallback(sqrt(noise - 55), 0) / 10 + fallback(log(density), -1) / 20 + 0.3)'),
  block('exp', 'clamp(exp(-forest / 5000) + exp(density - 1000) * 0 + exp(-density * 10))'),
  block('round', 'clamp(round(noise / 10 - 0.5) / 10 + floor(water / 9999) / 10 + ceil(beach / 9999) / 10)'),
  block('halves', 'clamp(round(density / 2) - floor(density / 2))'),
  block('min-max', 'clamp(1 - max(forest, water, beach) / 20000 + min(noise, 60) / 600)'),
  block('comparisons', 'clamp((forest < 1000) * 0.2 + (water <= 2000) * 0.2 + (noise > 55) * 0.2 + (density >= 50) * 0.2 + (zone == BYZONE) * 0.1 + (zone != LANDZONE) * 0.1)'),
  block('logic', 'clamp(((forest < 3000) && (water < 3000)) * 0.5 + ((noise < 50) || (density > 100)) * 0.5)'),
  block('not', 'clamp(!(forest < 3000) * 0.6 + !(zone == SOMMERHUS) * 0.4)'),
  block('ternary', 'noise > 60 ? 0 : forest < 2000 ? 1 : 0.5'),
  block('choice', 'let mode = choice(2, forest, water, beach)\nlet pick = slider(3000, 0, 20000, 100)\nramp(mode, pick / 10, pick)'),
  block('choice-out-of-range', 'fallback(choice(4, 1, 0), 0.75)'),
  block('equal-ramp-ends', 'ramp(forest, 1000, 1000)'),
  block('ramp-of-missing-ends', 'ramp(forest, noise * 50, 3000)'),
  block('outside', 'forest / 10000'),
  block('requirement', 'noise < 65 && zone != SOMMERHUS', 'must'),
  block('requirement-of-missing', 'no2 < 10 || pm25 < 7', 'must'),
  block('broken', 'forest +', 'want'),
  block('unknown', 'clamp(forrest / 1000)', 'want'),
];

const LIBRARY_BLOCKS: Block[] = LIBRARY.map((t) => block(`library-${t.id}`, t.code, t.role, t.weight));

describeWithDatabase('blocks in SQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let db: pg.Client;
  const values = randomValues(42);
  const columns = Object.fromEntries(NAMES.map((name) => [name, `t."${name}"`]));
  const inputs = { names: NAMES, values: (name: string) => values[name] ?? null };

  beforeAll(async () => {
    database = await createTestDatabase();
    db = new pg.Client({ connectionString: database.url });
    await db.connect();
    await db.query(`create table t (id int primary key, ${NAMES.map((name) => `"${name}" float8`).join(', ')})`);
    // The same 32-bit values as the browser's, missing as NULL
    const rows = Array.from({ length: ROWS }, (_, i) => [i, ...NAMES.map((name) => (Number.isNaN(values[name][i]) ? null : values[name][i]))]);
    for (let start = 0; start < ROWS; start += 500) {
      const chunk = rows.slice(start, start + 500);
      const width = NAMES.length + 1;
      const placeholders = chunk.map((_, r) => `(${Array.from({ length: width }, (_, c) => `$${r * width + c + 1}`).join(', ')})`).join(', ');
      await db.query(`insert into t values ${placeholders}`, chunk.flat());
    }
  }, 60_000);

  afterAll(async () => {
    await db?.end();
    await database?.drop();
  }, 60_000);

  /** The SQL's numbers per row, NaN for NULL. */
  async function query(expression: string): Promise<Float64Array> {
    const { rows } = await db.query<{ v: number | null }>(`select ${expression} as v from t order by id`);
    return Float64Array.from(rows, (r) => (r.v === null ? NaN : r.v));
  }

  const same = (a: number, b: number, tolerance: number) => (Number.isNaN(a) && Number.isNaN(b)) || a === b || Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a));

  it('gives every block the values the browser gives it, row by row', async () => {
    const checked: string[] = [];
    for (const b of [...BLOCKS, ...LIBRARY_BLOCKS]) {
      const { blocks, issues } = weightingSql([b], columns);
      const browser = runBlock(b, ROWS, inputs);
      if ('issue' in browser) {
        // A block that cannot run in the browser either does not run in SQL, or gives a score outside 0–1 somewhere
        const sql = blocks.get(b.id);
        if (sql) expect((await db.query(`select bool_or(${sql.outside}) as outside from t`)).rows[0].outside, b.id).toBe(true);
        else expect(issues.get(b.id), b.id).toBe(browser.issue);
        continue;
      }
      const sql = blocks.get(b.id)!;
      expect(sql, `${b.id}: ${issues.get(b.id)}`).toBeDefined();
      expect((await db.query(`select bool_or(${sql.outside}) as outside from t`)).rows[0].outside, b.id).toBe(false);
      const fromSql = await query(sql.value);
      const differing = Array.from(fromSql.keys()).filter((i) => !same(browser.values[i], fromSql[i], 1e-6));
      expect(differing.map((i) => `${b.id} row ${i}: browser ${browser.values[i]}, SQL ${fromSql[i]}`).slice(0, 3)).toEqual([]);
      checked.push(b.id);
    }
    // Every predefined block, and the made-up ones but those that cannot run
    expect(checked.length).toBe(BLOCKS.length - 3 + LIBRARY_BLOCKS.length);
  }, 60_000);

  it('gives every row the points the browser gives it', async () => {
    const weightings = [
      LIBRARY_BLOCKS.filter((b) => b.role === 'want').slice(0, 6),
      [...BLOCKS.filter((b) => !['outside', 'broken', 'unknown'].includes(b.id))],
      [...LIBRARY_BLOCKS.slice(0, 4), BLOCKS.find((b) => b.id === 'requirement')!],
    ];
    for (const blocks of weightings) {
      const browser = evaluateBlocks(blocks, ROWS, inputs);
      const { points } = weightingSql(blocks, columns);
      const fromSql = await query(points!);
      // The browser marks a row that fails a requirement with -1
      const expected = Array.from(browser.scores, (s) => (s < 0 ? NaN : s));
      const differing = expected.map((e, i) => (same(e, fromSql[i], 1e-5) ? -1 : i)).filter((i) => i >= 0);
      expect(differing.map((i) => `row ${i}: browser ${expected[i]}, SQL ${fromSql[i]}`).slice(0, 3)).toEqual([]);
      expect(expected.filter(Number.isNaN).length).toBe(Array.from(fromSql).filter(Number.isNaN).length);
    }
  }, 60_000);

  it('has no points without a preference, and says why a block cannot run', () => {
    const { points, issues } = weightingSql([BLOCKS.find((b) => b.id === 'requirement')!, BLOCKS.find((b) => b.id === 'unknown')!], columns);
    expect(points).toBeNull();
    expect(issues.get('unknown')).toMatch(/Unknown name “forrest”/);
  });
});
