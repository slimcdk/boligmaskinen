import pg from 'pg';
import type { FastifyBaseLogger } from 'fastify';
import { migrate } from './migrate.ts';

/**
 * Connects to PostgreSQL and brings the schema up to date. The database may still be starting
 * (as with docker compose), so it is tried again for up to `waitSeconds`.
 */
export async function openDatabase(url: string, log: FastifyBaseLogger, waitSeconds = 60): Promise<pg.Pool> {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  // An idle connection that breaks must not crash the app
  pool.on('error', (error) => log.warn({ err: error }, 'A database connection failed'));
  const deadline = Date.now() + waitSeconds * 1000;
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query('select 1');
      break;
    } catch (error) {
      if (Date.now() > deadline) {
        await pool.end();
        throw new Error(`Could not reach the database: ${(error as Error).message}`, { cause: error });
      }
      log.info(`Waiting for the database (attempt ${attempt})`);
      await new Promise((resolve) => setTimeout(resolve, Math.min(5000, 500 * attempt)));
    }
  }
  const applied = await migrate(pool);
  if (applied.length) log.info({ migrations: applied }, `Applied ${applied.length} database migration(s)`);
  return pool;
}

/** How the database is, for /api/health. */
export async function databaseHealth(pool: pg.Pool | null): Promise<'ok' | 'not configured' | 'unreachable'> {
  if (!pool) return 'not configured';
  try {
    await pool.query('select 1');
    return 'ok';
  } catch {
    return 'unreachable';
  }
}
