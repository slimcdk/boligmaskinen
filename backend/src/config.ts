import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type BuildInfo, versionFromEnv } from './version.ts';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
const LOG_LEVELS: LogLevel[] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

/** The backend's settings, read from the environment (see README.md). */
export interface Config {
  port: number;
  host: string;
  /** The built frontend. */
  staticDir: string;
  /** The data pack; null when the frontend's build holds one. */
  dataPackDir: string | null;
  /** Where the data jobs keep the raw archive, their work and the data packs; null when they cannot run. */
  dataDir: string | null;
  /** The Python that has the data pipeline installed (pipeline/.venv/bin/python). */
  pipelinePython: string;
  /** go-pmtiles, which cuts the region's basemap out of Protomaps' planet build. */
  pmtiles: string;
  /** The grid the data is built on: its cell size, and the municipalities it covers. */
  grid: GridSettings;
  /** PostgreSQL with PostGIS. Without it the app runs, but the parts that need the database say so. */
  databaseUrl: string | null;
  /** The time zone the job schedules are in. */
  timeZone: string;
  logLevel: LogLevel;
  /** Which version is running; null lets the frontend fall back to its build-info.json. */
  version: BuildInfo | null;
}

export interface GridSettings {
  /** GRID_CELL_METRES: 100 by default. */
  cellMetres: number;
  /** REGION: denmark, oestjylland, aarhus, or municipality codes such as 751,706. */
  region: string;
}

/** The regions the pipeline's grid step knows by name (pipeline/src/boligmaskinen_pipeline/grid.py). */
export const REGIONS: Record<string, string> = { denmark: 'all of Denmark', oestjylland: 'East Jutland', aarhus: 'Aarhus Kommune' };

/** Every wrong setting at once, so they can all be fixed in one go. */
export class ConfigError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`The configuration is not valid:\n${problems.map((p) => `- ${p}`).join('\n')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const problems: string[] = [];

  const port = Number(env['PORT'] ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push(`PORT has to be a port number from 1 to 65535, not "${env['PORT']}"`);

  const databaseUrl = env['DATABASE_URL'] || null;
  if (databaseUrl && !/^postgres(ql)?:\/\//.test(databaseUrl)) problems.push('DATABASE_URL has to start with postgres:// or postgresql://');

  const timeZone = env['JOB_TIME_ZONE'] || 'Europe/Copenhagen';
  if (!isTimeZone(timeZone)) problems.push(`JOB_TIME_ZONE has to be a time zone such as Europe/Copenhagen, not "${timeZone}"`);

  const logLevel = (env['LOG_LEVEL'] || 'info') as LogLevel;
  if (!LOG_LEVELS.includes(logLevel)) problems.push(`LOG_LEVEL has to be one of ${LOG_LEVELS.join(', ')}, not "${logLevel}"`);

  const dataDir = env['DATA_DIR'] || null;
  if (dataDir && !isAbsolute(dataDir)) problems.push(`DATA_DIR has to be an absolute path, not "${dataDir}"`);

  const cellMetres = Number(env['GRID_CELL_METRES'] || 100);
  if (!Number.isInteger(cellMetres) || cellMetres < 10 || cellMetres > 1000) {
    problems.push(`GRID_CELL_METRES has to be a whole number of metres from 10 to 1000, not "${env['GRID_CELL_METRES']}"`);
  }
  const region = env['REGION'] || 'denmark';
  if (!(region in REGIONS) && !/^\d{3}(,\d{3})*$/.test(region)) {
    problems.push(`REGION has to be ${Object.keys(REGIONS).join(', ')} or municipality codes such as 751,706, not "${region}"`);
  }

  if (problems.length) throw new ConfigError(problems);
  return {
    port,
    host: env['HOST'] || '0.0.0.0',
    staticDir: env['STATIC_DIR'] || fileURLToPath(new URL('../../frontend/dist/frontend/browser', import.meta.url)),
    dataPackDir: env['DATA_PACK_DIR'] || null,
    dataDir,
    pipelinePython: env['PIPELINE_PYTHON'] || fileURLToPath(new URL('../../pipeline/.venv/bin/python', import.meta.url)),
    pmtiles: env['PMTILES'] || 'pmtiles',
    grid: { cellMetres, region },
    databaseUrl,
    timeZone,
    logLevel,
    version: versionFromEnv(env),
  };
}
