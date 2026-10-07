import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';

/** The default folder of the migrations: backend/migrations. */
export const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url));

/** Any number, the same for every instance: only one of them migrates at a time. */
const LOCK = 7_301_102;

/**
 * Applies the SQL files in the migrations folder that have not been applied yet, in the order of
 * their names (0001_…, 0002_…), each in its own transaction. Migrations only go forward: a mistake
 * is fixed by the next migration. Returns the names that were applied.
 */
export async function migrate(pool: pg.Pool, dir = MIGRATIONS_DIR): Promise<string[]> {
  const client = await pool.connect();
  try {
    await client.query('select pg_advisory_lock($1)', [LOCK]);
    await client.query('create table if not exists schema_migration (name text primary key, applied_at timestamptz not null default now())');
    const done = new Set((await client.query<{ name: string }>('select name from schema_migration')).rows.map((r) => r.name));
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    const applied: string[] = [];
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(join(dir, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migration (name) values ($1)', [file]);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw new Error(`The migration ${file} failed: ${(error as Error).message}`, { cause: error });
      }
      applied.push(file);
    }
    return applied;
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK]).catch(() => undefined);
    client.release();
  }
}
