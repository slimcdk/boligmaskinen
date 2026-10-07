import { buildApp } from './app.ts';
import { ConfigError, loadConfig } from './config.ts';

let config;
try {
  config = loadConfig(process.env);
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(error.message);
  process.exit(1);
}

const app = await buildApp(config);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => void app.close());
await app.listen({ port: config.port, host: config.host });
