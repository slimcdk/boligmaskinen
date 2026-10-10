import { mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';

const FAKE_PYTHON = fileURLToPath(new URL('./sources/fake-python.sh', import.meta.url));
const version = { version: '', revision: 'abc1234', source: '', created: '' };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A DATA_DIR with a data pack and, unless `roads` is false, a road network: with a timetable when `transit` is true. */
function dataDir(options: { pack?: string; roads?: string | false; transit?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'travel-'));
  const pack = options.pack ?? '20261010T030000Z-run1';
  mkdirSync(join(dir, 'packs', pack, 'data'), { recursive: true });
  writeFileSync(join(dir, 'packs', pack, 'data', 'meta.json'), JSON.stringify({ pack }));
  symlinkSync(`packs/${pack}`, join(dir, 'data-pack'));
  if (options.roads !== false) network(dir, options.roads ?? '20261010T020000Z-run2', options.transit);
  return dir;
}

function network(dir: string, id: string, transit = false): void {
  mkdirSync(join(dir, 'work', 'roads', id), { recursive: true });
  writeFileSync(join(dir, 'work', 'roads', id, 'counts.json'), '{}');
  if (transit) writeFileSync(join(dir, 'work', 'roads', id, 'transit.json'), '{"day": "2026-10-06"}');
  // Switched in as the jobs do it
  const link = join(dir, 'work', 'roads', 'current');
  rmSync(`${link}.new`, { force: true });
  symlinkSync(id, `${link}.new`);
  renameSync(`${link}.new`, link);
}

describe('travel times', () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => app?.close());

  const start = async (dir: string | null) => {
    app = await buildApp({ staticDir: '/nonexistent', dataPackDir: null, dataDir: dir ?? undefined, databaseUrl: null, version, logLevel: false, pipelinePython: FAKE_PYTHON });
    return app;
  };
  const ask = async (lng: number, lat: number) => (await app!.inject({ method: 'POST', url: '/api/travel', payload: { lng, lat } })).json();
  async function ready(lng: number, lat: number) {
    for (let tries = 0; tries < 50; tries++) {
      const state = await ask(lng, lat);
      if (state.state !== 'working') return state;
      await wait(100);
    }
    throw new Error('Still working');
  }

  it('finds them for a place once, and serves each mode for good', async () => {
    const dir = dataDir();
    await start(dir);
    const first = await ask(10.2039, 56.15);
    expect(first).toEqual({ id: expect.stringMatching(/^[0-9a-f]{24}$/), state: 'working' });
    const done = await ready(10.2039, 56.15);
    // A network without a timetable has none by public transport
    expect(done).toEqual({ id: first.id, state: 'ready', modes: ['car', 'bike', 'walk'] });
    const car = await app!.inject(`/api/travel/${first.id}/car`);
    expect(car.statusCode).toBe(200);
    expect(car.body).toBe('car to 10.20390,56.15000 on 20261010T020000Z-run2');
    expect(car.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    // The same place again is ready at once, under the same id; the step ran once
    expect(await ask(10.20390001, 56.15)).toEqual({ id: first.id, state: 'ready', modes: ['car', 'bike', 'walk'] });
    expect((await app!.inject(`/api/travel/${first.id}/transit`)).statusCode).toBe(404);
    expect(readdirSync(join(dir, 'travel'))).toEqual(['20261010T030000Z-run1--20261010T020000Z-run2']);
  });

  it('finds them by public transport too on a network with a timetable', async () => {
    await start(dataDir({ transit: true }));
    const done = await ready(10.2039, 56.15);
    expect(done).toEqual({ id: expect.any(String), state: 'ready', modes: ['car', 'bike', 'walk', 'transit'] });
    expect((await app!.inject(`/api/travel/${done.id}/transit`)).body).toBe('transit to 10.20390,56.15000 on 20261010T020000Z-run2');
  });

  it('finds them again on a new road network, and forgets the old ones', async () => {
    const dir = dataDir();
    await start(dir);
    const old = await ready(10.2039, 56.15);
    network(dir, '20261011T020000Z-run9');
    const next = await ready(10.2039, 56.15);
    expect(next.id).not.toBe(old.id);
    expect((await app!.inject(`/api/travel/${next.id}/walk`)).body).toBe('walk to 10.20390,56.15000 on 20261011T020000Z-run9');
    expect((await app!.inject(`/api/travel/${old.id}/walk`)).statusCode).toBe(404);
    expect(readdirSync(join(dir, 'travel'))).toEqual(['20261010T030000Z-run1--20261011T020000Z-run9']);
  });

  it('says why when there are none', async () => {
    await start(dataDir({ roads: false }));
    expect(await ask(10.2, 56.1)).toEqual({ id: '', state: 'unavailable', message: 'The road network is not built yet: the Road network job builds it' });
    await app!.close();
    await start(null);
    expect((await ask(10.2, 56.1)).state).toBe('unavailable');
    await app!.close();
    await start(dataDir());
    // The step fails for this position, and says why
    expect(await ready(0, 56.1)).toEqual({ id: expect.any(String), state: 'failed', message: 'There is no road near (0, 0)' });
    const wrong = await app!.inject({ method: 'POST', url: '/api/travel', payload: { lng: 200, lat: 56 } });
    expect(wrong.statusCode).toBe(400);
    expect((await app!.inject('/api/travel/0123456789abcdef01234567/train')).statusCode).toBe(400);
  });
});
