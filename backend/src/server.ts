import { fileURLToPath } from 'node:url';
import { buildApp } from './app.ts';
import { versionFromEnv } from './version.ts';

const env = process.env;
const app = await buildApp({
  staticDir: env['STATIC_DIR'] ?? fileURLToPath(new URL('../../frontend/dist/frontend/browser', import.meta.url)),
  dataPackDir: env['DATA_PACK_DIR'] || null,
  version: versionFromEnv(env),
  logger: true,
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => void app.close());
await app.listen({ port: Number(env['PORT'] ?? 8080), host: env['HOST'] ?? '0.0.0.0' });
