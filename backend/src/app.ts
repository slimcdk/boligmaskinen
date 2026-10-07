import compress from '@fastify/compress';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { Config, LogLevel } from './config.ts';
import { databaseHealth, openDatabase } from './db/database.ts';
import { apiError, registerErrorHandler } from './errors.ts';

declare module 'fastify' {
  interface FastifyInstance {
    /** The database, or null when the app runs without one. */
    db: pg.Pool | null;
  }
}

export type AppOptions = Pick<Config, 'staticDir' | 'dataPackDir' | 'databaseUrl' | 'version'> & {
  /** False for no logs, as in the tests. */
  logLevel?: LogLevel | false;
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
  app.addHook('onClose', async () => db?.end());

  app.get('/api/health', async (_request, reply) => {
    const database = await databaseHealth(db);
    return reply.code(database === 'unreachable' ? 503 : 200).send({ status: database === 'unreachable' ? 'degraded' : 'ok', database });
  });
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
  if (options.dataPackDir) {
    await app.register(fastifyStatic, { root: options.dataPackDir, prefix: '/data-pack/', decorateReply: false });
  }

  // The frontend is a single page, so its own paths get index.html; the API and data do not
  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split('?')[0];
    if (request.method !== 'GET' || path.startsWith('/api/') || path.startsWith('/data-pack/')) {
      return reply.code(404).send(apiError(404, `Not found: ${path}`));
    }
    return reply.sendFile('index.html');
  });
  return app;
}
