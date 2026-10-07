import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { migrate } from '../src/db/migrate.ts';
import { createTestDatabase, describeWithDatabase } from './database.ts';

describeWithDatabase('the database', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let dir: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    dir = mkdtempSync(join(tmpdir(), 'migrations-'));
  });

  afterAll(async () => {
    await database.drop();
    rmSync(dir, { recursive: true, force: true });
  });

  it('applies the migrations once, in the order of their names', async () => {
    writeFileSync(join(dir, '0002_second.sql'), 'insert into note (text) values (\'second\');');
    writeFileSync(join(dir, '0001_first.sql'), 'create table note (text text); insert into note (text) values (\'first\');');
    const pool = new pg.Pool({ connectionString: database.url });
    try {
      expect(await migrate(pool, dir)).toEqual(['0001_first.sql', '0002_second.sql']);
      expect(await migrate(pool, dir)).toEqual([]);
      expect((await pool.query('select text from note')).rows.map((r) => r.text)).toEqual(['first', 'second']);
    } finally {
      await pool.end();
    }
  });

  it('applies nothing of a migration that fails, and says which one', async () => {
    writeFileSync(join(dir, '0003_broken.sql'), 'insert into note (text) values (\'third\'); select * from no_such_table;');
    const pool = new pg.Pool({ connectionString: database.url });
    try {
      await expect(migrate(pool, dir)).rejects.toThrow('The migration 0003_broken.sql failed: relation "no_such_table" does not exist');
      expect((await pool.query('select count(*)::int as n from note')).rows[0].n).toBe(2);
    } finally {
      rmSync(join(dir, '0003_broken.sql'));
      await pool.end();
    }
  });

  it('lets only one instance migrate at a time', async () => {
    writeFileSync(join(dir, '0004_slow.sql'), 'select pg_sleep(0.3); insert into note (text) values (\'fourth\');');
    const pools = [new pg.Pool({ connectionString: database.url }), new pg.Pool({ connectionString: database.url })];
    try {
      const results = await Promise.all(pools.map((pool) => migrate(pool, dir)));
      expect(results.flat()).toEqual(['0004_slow.sql']);
      expect((await pools[0].query('select count(*)::int as n from note where text = \'fourth\'')).rows[0].n).toBe(1);
    } finally {
      await Promise.all(pools.map((pool) => pool.end()));
    }
  });

  it('starts the app with PostGIS and reports the database as healthy', async () => {
    const app = await buildApp({ staticDir: dir, dataPackDir: null, databaseUrl: database.url, version: null, logLevel: false });
    try {
      expect((await app.inject('/api/health')).json()).toEqual({ status: 'ok', database: 'ok' });
      const postgis = await app.db!.query('select postgis_version() as version');
      expect(postgis.rows[0].version).toMatch(/^3\./);
    } finally {
      await app.close();
    }
  });
});
