import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { runProgram } from '../pipeline/python.ts';
import { NEEDS_DATA_DIR } from '../pipeline/sources.ts';
import { formatBytes } from './data-pack.ts';
import type { JobContext, JobDefinition, JobOutcome } from './types.ts';

export interface BackupOptions {
  databaseUrl: string | null;
  dataDir: string | null;
  /** pg_dump of PostgreSQL 18 or newer, as the server. */
  pgDump: string;
  /** How many dumps to keep. */
  keep?: number;
}

/** libpq's variables for a database URL, so the password is not on the command line. */
export function libpqEnv(databaseUrl: string): Record<string, string> {
  const url = new URL(databaseUrl);
  const sslmode = url.searchParams.get('sslmode');
  return {
    PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    ...(sslmode ? { PGSSLMODE: sslmode } : {}),
  };
}

/**
 * A dump of the database in pg_dump's custom format: the maps and places, the job runs, the raw
 * archive's records and the migrations applied. pg-boss's queue is left out; the app makes it
 * again at start. The newest `keep` dumps stay in DATA_DIR/backups.
 */
async function backUp(context: JobContext, options: BackupOptions & { databaseUrl: string; dataDir: string }): Promise<JobOutcome> {
  const dir = join(options.dataDir, 'backups');
  await mkdir(dir, { recursive: true });
  const name = `${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}.dump`;
  const partial = join(dir, `.${name}.partial`);
  try {
    await runProgram(context, {
      program: options.pgDump, tmpDir: join(options.dataDir, 'tmp'), env: libpqEnv(options.databaseUrl),
      missing: `pg_dump is missing: ${options.pgDump}. Install PostgreSQL's client 18, or set PG_DUMP.`,
    }, ['--format=custom', '--no-owner', '--no-privileges', '--exclude-schema=pgboss', `--file=${partial}`]);
    await rename(partial, join(dir, name));
  } finally {
    await rm(partial, { force: true });
  }
  const dumps = (await readdir(dir)).filter((f) => f.endsWith('.dump')).sort();
  for (const old of dumps.slice(0, Math.max(0, dumps.length - (options.keep ?? 7)))) await rm(join(dir, old), { force: true });
  const bytes = (await stat(join(dir, name))).size;
  return { result: `backups/${name}, ${formatBytes(bytes)}`, bytes };
}

/** The nightly backup of the database. */
export function backupJob(options: BackupOptions): JobDefinition {
  const job = {
    id: 'backup', name: 'Back up the database', kind: 'backup' as const, source: 'Boligmaskinen', schedule: '30 1 * * *', enabledByDefault: true,
    description: 'A dump of the maps, places and job history, kept for a week in DATA_DIR/backups; README.md says how to restore it.',
  };
  const { databaseUrl, dataDir } = options;
  if (!databaseUrl || !dataDir) return { ...job, blocked: NEEDS_DATA_DIR };
  return { ...job, run: (context) => backUp(context, { ...options, databaseUrl, dataDir }) };
}
