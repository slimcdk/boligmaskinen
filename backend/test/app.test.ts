import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { versionFromEnv } from '../src/version.ts';

let dir: string;
const bundle = `console.log(${JSON.stringify('x'.repeat(4000))});`;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'boligmaskinen-'));
  mkdirSync(join(dir, 'app'));
  writeFileSync(join(dir, 'app', 'index.html'), '<app-root></app-root>');
  writeFileSync(join(dir, 'app', 'main-V4FIJJ6A.js'), bundle);
  writeFileSync(join(dir, 'app', 'maplibre-gl-worker.mjs'), 'self.onmessage = () => {};');
  mkdirSync(join(dir, 'pack', 'data'), { recursive: true });
  writeFileSync(join(dir, 'pack', 'data', 'meta.json'), '{"region":{"id":"aarhus"}}');
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const app = (version = versionFromEnv({ APP_REVISION: 'abcdef1234567', APP_SOURCE: 'https://github.com/owner/boligmaskinen' })) =>
  buildApp({ staticDir: join(dir, 'app'), dataPackDir: join(dir, 'pack'), version });

describe('the app server', () => {
  it('serves the frontend, and its own paths as the single page', async () => {
    const server = await app();
    const home = await server.inject('/');
    expect(home.statusCode).toBe(200);
    expect(home.headers['content-type']).toContain('text/html');
    expect(home.headers['cache-control']).toBe('no-cache');
    const deep = await server.inject('/some/view?map=1');
    expect(deep.statusCode).toBe(200);
    expect(deep.body).toBe('<app-root></app-root>');
  });

  it('lets the hashed bundles be cached for good, and compresses them', async () => {
    const server = await app();
    const response = await server.inject({ url: '/main-V4FIJJ6A.js', headers: { 'accept-encoding': 'gzip' } });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(response.headers['content-encoding']).toBe('gzip');
    const worker = await server.inject('/maplibre-gl-worker.mjs');
    expect(worker.headers['content-type']).toMatch(/javascript/);
  });

  it('serves the data pack from its own folder', async () => {
    const server = await app();
    const meta = await server.inject('/data-pack/data/meta.json');
    expect(meta.statusCode).toBe(200);
    expect(meta.json()).toEqual({ region: { id: 'aarhus' } });
    const missing = await server.inject('/data-pack/basemap/part-0.png');
    expect(missing.statusCode).toBe(404);
  });

  it('tells which version is running, when the image says so', async () => {
    const version = await (await app()).inject('/api/version');
    expect(version.statusCode).toBe(200);
    expect(version.headers['cache-control']).toBe('no-store');
    expect(version.json()).toEqual({ version: '', revision: 'abcdef1234567', source: 'https://github.com/owner/boligmaskinen', created: '' });
    // A local run knows nothing, so the frontend falls back to its build-info.json
    expect((await (await app(null)).inject('/api/version')).statusCode).toBe(404);
  });

  it('answers unknown API paths with 404, not the page', async () => {
    const server = await app();
    const response = await server.inject('/api/nothing');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Not found: /api/nothing' });
    expect((await server.inject('/api/health')).json()).toEqual({ status: 'ok' });
  });
});

describe('versionFromEnv', () => {
  it('reads the release and commit from the environment', () => {
    expect(versionFromEnv({ APP_VERSION: 'v1.2.0', APP_REVISION: 'abc', APP_SOURCE: 's', APP_CREATED: 'c' }))
      .toEqual({ version: 'v1.2.0', revision: 'abc', source: 's', created: 'c' });
    expect(versionFromEnv({ APP_VERSION: '', APP_REVISION: '' })).toBeNull();
  });
});
