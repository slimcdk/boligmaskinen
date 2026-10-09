import compress from '@fastify/compress';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type pg from 'pg';
import type { Config, LogLevel } from './config.ts';
import { databaseHealth, openDatabase } from './db/database.ts';
import { apiError, registerErrorHandler } from './errors.ts';
import { defineJobs } from './jobs/definitions.ts';
import { JobRunner } from './jobs/runner.ts';
import type { JobDefinition } from './jobs/types.ts';
import { Archive } from './pipeline/archive.ts';
import { PROTOMAPS_URLS } from './pipeline/builds.ts';
import { FETCH_JOBS, type SourceUrls } from './pipeline/sources.ts';
import { dataPackRoutes } from './routes/data-pack.ts';
import { jobRoutes } from './routes/jobs.ts';
import { profileRoutes } from './routes/profile.ts';

declare module 'fastify' {
  interface FastifyInstance {
    /** The database, or null when the app runs without one. */
    db: pg.Pool | null;
  }
}

export type AppOptions = Pick<Config, 'staticDir' | 'dataPackDir' | 'databaseUrl' | 'version'>
  & Partial<Pick<Config, 'timeZone' | 'dataDir' | 'pipelinePython' | 'pmtiles' | 'grid'>> & {
  /** False for no logs, as in the tests. */
  logLevel?: LogLevel | false;
  /** The data jobs; the tests bring their own. */
  jobs?: JobDefinition[];
  /** How often an idle job worker asks for work. */
  jobPollSeconds?: number;
  /** Where the jobs fetch from; the tests point them at a server of their own. */
  sourceUrls?: Partial<SourceUrls>;
  protomapsUrls?: Partial<typeof PROTOMAPS_URLS>;
};

/** Angular's bundles have a hash in their name (main-V4FIJJ6A.js), so they never change. */
const HASHED = /-[A-Z0-9]{8}\.(js|css)$/;

/** The app: the frontend, its data pack and the API, all from one server. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logLevel === false ? false : { level: options.logLevel ?? 'info' } });
  registerErrorHandler(app);
  await app.register(compress);

  const db = options.databaseUrl ? await openDatabase(options.databaseUrl, app.log) : null;
  app.decorate('db', db);
  const dataDir = options.dataDir ?? null;
  // The data jobs switch the pack in through DATA_DIR/data-pack; without either, the frontend's build has one
  const dataPackDir = options.dataPackDir ?? (dataDir ? join(dataDir, 'data-pack') : null);
  const definitions = options.jobs ?? defineJobs({
    dataDir, dataPackDir, python: options.pipelinePython ?? 'python3', pmtiles: options.pmtiles ?? 'pmtiles',
    grid: options.grid ?? { cellMetres: 100, region: 'denmark' },
    revision: options.version?.revision || options.version?.version || 'dev', timeZone: options.timeZone,
    urls: options.sourceUrls, protomaps: options.protomapsUrls,
  });
  // What downloads left behind when the app stopped during one; no job runs yet
  if (db && dataDir) await new Archive(db, dataDir).cleanTmp();
  const runner = db && options.databaseUrl
    ? await JobRunner.start({
      db, databaseUrl: options.databaseUrl, definitions, timeZone: options.timeZone ?? 'Europe/Copenhagen',
      dataPackDir: dataPackDir ?? join(options.staticDir, 'data-pack'), log: app.log, pollSeconds: options.jobPollSeconds,
    })
    : null;
  // A new install fetches everything, and the builds follow. Where the jobs fetch already, a source
  // that came with a new version is fetched at once, rather than on its schedule
  if (runner && db && dataDir && dataPackDir && !options.jobs) {
    const hasPack = await stat(join(dataPackDir, 'data', 'meta.json')).then(() => true, () => false);
    const fetched = new Set((await db.query<{ source: string }>('select distinct source from source_file')).rows.map((r) => r.source));
    if (!hasPack) {
      app.log.info('There is no data pack yet, so the data jobs fetch every source now');
      await runner.startAll(Object.keys(FETCH_JOBS), 'There is no data pack yet, so every source is fetched now');
    } else if (fetched.size) {
      const fresh = Object.keys(FETCH_JOBS).filter((id) => !fetched.has(id));
      if (fresh.length) await runner.startAll(fresh, 'A source that has not been fetched yet, so it is fetched now');
    }
  }
  app.addHook('onClose', async () => {
    await runner?.stop();
    await db?.end();
  });

  app.get('/api/health', async (_request, reply) => {
    const database = await databaseHealth(db);
    return reply.code(database === 'unreachable' ? 503 : 200).send({ status: database === 'unreachable' ? 'degraded' : 'ok', database });
  });
  await jobRoutes(app, runner);
  await profileRoutes(app, db);
  app.get('/api/version', async (_request, reply) => {
    if (!options.version) return reply.code(404).send(apiError(404, 'This build does not know its version'));
    return reply.header('cache-control', 'no-store').send(options.version);
  });

  await app.register(fastifyStatic, {
    root: options.staticDir,
    setHeaders(reply, path) {
      if (HASHED.test(path)) reply.header('cache-control', 'public, max-age=31536000, immutable');
      else if (path.endsWith('index.html')) reply.header('cache-control', 'no-cache');
    },
  });
  if (dataPackDir) await dataPackRoutes(app, dataPackDir, dataDir ? join(dataDir, 'packs') : null);

  // The frontend is a single page, so its own paths get index.html; the API and data do not
  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split('?')[0];
    if (request.method !== 'GET' || path.startsWith('/api/') || path.startsWith('/data-pack/') || path.startsWith('/data-packs/')) {
      return reply.code(404).send(apiError(404, `Not found: ${path}`));
    }
    return reply.sendFile('index.html');
  });
  return app;
}
