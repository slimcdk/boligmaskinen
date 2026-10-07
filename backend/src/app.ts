import compress from '@fastify/compress';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { BuildInfo } from './version.ts';

export interface AppOptions {
  /** The built frontend: frontend/dist/frontend/browser. */
  staticDir: string;
  /** The data pack, served at data-pack/; null when the frontend's build has it. */
  dataPackDir: string | null;
  /** Which version is running; null lets the frontend fall back to its build-info.json. */
  version: BuildInfo | null;
  logger?: boolean;
}

/** Angular's bundles have a hash in their name (main-V4FIJJ6A.js), so they never change. */
const HASHED = /-[A-Z0-9]{8}\.(js|css)$/;

/** The app: the frontend, its data pack and the API, all from one server. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  await app.register(compress);

  app.get('/api/health', async () => ({ status: 'ok' }));
  app.get('/api/version', async (_request, reply) => {
    if (!options.version) return reply.code(404).send({ error: 'This build does not know its version' });
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
      return reply.code(404).send({ error: `Not found: ${path}` });
    }
    return reply.sendFile('index.html');
  });
  return app;
}
