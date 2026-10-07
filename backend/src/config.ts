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
  /** PostgreSQL with PostGIS. Without it the app runs, but the parts that need the database say so. */
  databaseUrl: string | null;
  /** The time zone the job schedules are in. */
  timeZone: string;
  logLevel: LogLevel;
  /** Which version is running; null lets the frontend fall back to its build-info.json. */
  version: BuildInfo | null;
}

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

  if (problems.length) throw new ConfigError(problems);
  return {
    port,
    host: env['HOST'] || '0.0.0.0',
    staticDir: env['STATIC_DIR'] || fileURLToPath(new URL('../../frontend/dist/frontend/browser', import.meta.url)),
    dataPackDir: env['DATA_PACK_DIR'] || null,
    databaseUrl,
    timeZone,
    logLevel,
    version: versionFromEnv(env),
  };
}
