import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../src/db/migrate.ts';
import { backupJob, libpqEnv } from '../src/jobs/backup.ts';
import { createTestDatabase, hasDatabase } from './database.ts';
import { runContext } from './sources/context.ts';

/** PostgreSQL 18's client; CI installs it, and elsewhere PG_DUMP and PG_RESTORE can point at it. */
const PG_DUMP = process.env['PG_DUMP'] || 'pg_dump';
const PG_RESTORE = process.env['PG_RESTORE'] || 'pg_restore';
const hasClient = (() => {
  try {
    // "pg_dump (PostgreSQL) 18.6 (Ubuntu 18.6-1.pgdg24.04+2)": the major version after "(PostgreSQL)"
    return Number(/\(PostgreSQL\) (\d+)/.exec(execFileSync(PG_DUMP, ['--version'], { encoding: 'utf8' }))?.[1] ?? 0) >= 18;
  } catch {
    return false;
  }
})();
if (!hasClient && process.env['CI']) throw new Error('CI needs pg_dump 18 for the backup tests');

describe.skipIf(!hasDatabase || !hasClient)('the backup of the database', () => {
  let source: Awaited<ReturnType<typeof createTestDatabase>>;
  let target: Awaited<ReturnType<typeof createTestDatabase>>;
  let db: pg.Pool;

  beforeAll(async () => {
    source = await createTestDatabase();
    target = await createTestDatabase();
    db = new pg.Pool({ connectionString: source.url });
    await migrate(db);
    await db.query(`insert into saved_map (id, name, blocks, groups) values ('m1', 'Family', '[{"id":"b1","code":"ramp(forest, 300, 3000)"}]', '[]')`);
    await db.query(`insert into place (id, name, lng, lat) values ('p1', 'Work', 10.2, 56.15)`);
    await db.query(`update profile set revision = 7`);
  }, 60_000);

  afterAll(async () => {
    await db?.end();
    await source?.drop();
    await target?.drop();
  });

  it('dumps the database, keeps a week of dumps, and restores into an empty database', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'backup-'));
    const job = backupJob({ databaseUrl: source.url, dataDir, pgDump: PG_DUMP, keep: 2 });
    // Two older dumps, of which the oldest goes
    const { context } = await runContext(db, 'backup');
    mkdirSync(join(dataDir, 'backups'));
    for (const stamp of ['20261001T013000Z', '20261002T013000Z']) writeFileSync(join(dataDir, 'backups', `${stamp}.dump`), 'old');
    const outcome = await job.run!(context);
    expect(outcome).toMatchObject({ result: expect.stringMatching(/^backups\/\d{8}T\d{6}Z\.dump, [\d.]+ kB$/) });
    const dumps = readdirSync(join(dataDir, 'backups'));
    expect(dumps).toHaveLength(2);
    expect(dumps).toContain('20261002T013000Z.dump');

    // Restore as README.md says, into an empty database
    const newest = dumps.sort().at(-1)!;
    execFileSync(PG_RESTORE, ['--no-owner', '--no-privileges', '--dbname', libpqEnv(target.url)['PGDATABASE'], join(dataDir, 'backups', newest)], {
      env: { ...process.env, ...libpqEnv(target.url) },
    });
    const restored = new pg.Pool({ connectionString: target.url });
    try {
      expect((await restored.query('select id, name, blocks from saved_map')).rows).toEqual([{ id: 'm1', name: 'Family', blocks: [{ id: 'b1', code: 'ramp(forest, 300, 3000)' }] }]);
      expect((await restored.query('select name, ST_AsText(geom) as geom from place')).rows).toEqual([{ name: 'Work', geom: 'POINT(10.2 56.15)' }]);
      expect((await restored.query('select revision from profile')).rows).toEqual([{ revision: 7 }]);
      // The migrations are there, so the app does not apply them again; pg-boss's queue is not
      expect((await restored.query('select count(*)::int as n from schema_migration')).rows[0].n).toBeGreaterThan(0);
      expect(await migrate(restored)).toEqual([]);
      expect((await restored.query(`select count(*)::int as n from information_schema.schemata where schema_name = 'pgboss'`)).rows[0].n).toBe(0);
    } finally {
      await restored.end();
    }
  }, 60_000);

  it('says how to get pg_dump when it is missing', async () => {
    const job = backupJob({ databaseUrl: source.url, dataDir: mkdtempSync(join(tmpdir(), 'backup-')), pgDump: '/nowhere/pg_dump' });
    const { context } = await runContext(db, 'backup');
    await expect(job.run!(context)).rejects.toThrow("pg_dump is missing: /nowhere/pg_dump. Install PostgreSQL's client 18, or set PG_DUMP.");
  });
});

it('reads libpq variables from a database URL, so the password stays off the command line', () => {
  expect(libpqEnv('postgres://user%40x:p%40ss@db:5433/boligmaskinen?sslmode=require')).toEqual({
    PGHOST: 'db', PGPORT: '5433', PGUSER: 'user@x', PGPASSWORD: 'p@ss', PGDATABASE: 'boligmaskinen', PGSSLMODE: 'require',
  });
});
