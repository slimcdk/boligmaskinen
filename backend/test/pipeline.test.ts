import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import type { Job, JobRun } from '../src/jobs/types.ts';
import { createTestDatabase, describeWithDatabase } from './database.ts';
import { TestServer } from './sources/server.ts';
import { type Sources, serveSources } from './sources/sources.ts';

const FAKE_PYTHON = fileURLToPath(new URL('./sources/fake-python.sh', import.meta.url));
const FAKE_PMTILES = fileURLToPath(new URL('./sources/fake-pmtiles.sh', import.meta.url));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describeWithDatabase('a new install', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let server: TestServer;
  let sources: Sources;
  let app: FastifyInstance;
  let dataDir: string;

  const list = async () => (await app.inject('/api/jobs')).json() as { jobs: Job[]; runs: JobRun[] };
  /** Waits until nothing is waiting or running, and returns the runs, oldest first. */
  async function settled(timeout = 60_000): Promise<JobRun[]> {
    const end = Date.now() + timeout;
    for (;;) {
      await wait(500);
      const { runs } = await list();
      if (!runs.some((r) => r.status === 'queued' || r.status === 'running')) return runs.reverse();
      if (Date.now() > end) throw new Error(`Still busy: ${runs.filter((r) => r.status === 'running').map((r) => r.jobId).join(', ')}`);
    }
  }
  const meta = async (path = '/data-pack/data/meta.json') => (await app.inject(path)).json() as { pack: string; cellMetres: number; region: { id: string } };

  beforeAll(async () => {
    database = await createTestDatabase();
    server = await TestServer.start();
    const served = serveSources(server);
    sources = served.sources;
    dataDir = mkdtempSync(join(tmpdir(), 'install-'));
    app = await buildApp({
      staticDir: '/nonexistent', dataPackDir: null, dataDir, databaseUrl: database.url, logLevel: false, jobPollSeconds: 0.5, timeZone: 'UTC',
      version: { version: '', revision: 'abc1234', source: '', created: '' },
      pipelinePython: FAKE_PYTHON, pmtiles: FAKE_PMTILES, grid: { cellMetres: 200, region: 'aarhus' },
      sourceUrls: served.urls, protomapsUrls: served.protomaps,
    });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await server?.close();
    await database?.drop();
  });

  it('has no data pack at first, and says so', async () => {
    const response = await app.inject('/data-pack/data/meta.json');
    // The jobs may have finished already on a fast machine
    if (response.statusCode === 404) expect(response.json().message).toBe('There is no data pack yet: the data jobs build it');
  });

  it('fetches every source, then builds the grid, the basemap and the pack, and serves it', async () => {
    const runs = await settled();
    const outcome = (jobId: string) => runs.filter((r) => r.jobId === jobId).map((r) => `${r.status}: ${r.result ?? r.message}`);
    for (const job of ['osm', 'plandata', 'stil-schools', 'stil-daycare', 'ens', 'dst', 'noise', 'world']) {
      expect(runs.find((r) => r.jobId === job)).toMatchObject({ status: 'succeeded', trigger: 'schedule', log: expect.arrayContaining([expect.objectContaining({ text: 'There is no data pack yet, so every source is fetched now' })]) });
    }
    // The grid waited for the sources and was built once, when the last of them was in
    expect(outcome('grid').filter((o) => o.includes(' cells '))).toEqual(['succeeded: aarhus: 2 × 2 cells of 200 m, 459,924 with homes']);
    expect(outcome('basemap')).toEqual([expect.stringMatching(/^succeeded: Planet build 20261009 up to zoom 12, \d+ B$/)]);
    expect(outcome('pack').filter((o) => o.includes('Switched'))).toHaveLength(1);
    expect(runs.filter((r) => r.status === 'failed')).toEqual([]);
    expect(outcome('data-pack')).toEqual(['succeeded: 1 layer']);

    const served = await meta();
    expect(served).toMatchObject({ pack: expect.stringMatching(/^\d{8}T\d{6}Z-run\d+$/), cellMetres: 200, region: { id: 'aarhus' } });
    expect(readlinkSync(join(dataDir, 'data-pack'))).toBe(`packs/${served.pack}`);
    const current = await app.inject('/data-pack/data/meta.json');
    expect(current.headers['cache-control']).toBe('no-cache');
    // Every kept pack has a path of its own, which never changes
    const own = await app.inject(`/data-packs/${served.pack}/basemap/part-0.png`);
    expect(own.statusCode).toBe(200);
    expect(own.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(own.body).toMatch(/^tiles of .*"region":"aarhus".* from http:\/\/127\.0\.0\.1:\d+\/tiles\/20261009\.pmtiles$/);
  });

  it('builds again only what a changed source touches, and keeps serving the old pack beside the new one', async () => {
    const before = await meta();
    sources.zones = 3;
    expect((await app.inject({ method: 'POST', url: '/api/jobs/plandata/run' })).statusCode).toBe(202);
    const runs = await settled();
    const latest = (jobId: string) => runs.filter((r) => r.jobId === jobId).at(-1)!;
    expect(latest('plandata')).toMatchObject({ status: 'succeeded', result: '3 polygons' });
    expect(latest('grid')).toMatchObject({ trigger: 'after', result: expect.stringContaining('cells of 200 m') });
    // The outline is the same, so the basemap was not cut again
    expect(latest('basemap')).toMatchObject({ result: 'Unchanged: planet build 20261009' });
    const after = await meta();
    expect(after.pack).not.toBe(before.pack);
    expect((await meta(`/data-packs/${before.pack}/data/meta.json`)).pack).toBe(before.pack);
    expect(readdirSync(join(dataDir, 'packs')).filter((d) => !d.startsWith('.')).sort()).toEqual([before.pack, after.pack].sort());
  });

  it('cuts a new basemap on its schedule when Protomaps has a newer build', async () => {
    sources.planetBuild = '20261010.pmtiles';
    await app.inject({ method: 'POST', url: '/api/jobs/basemap/run' });
    const runs = await settled();
    expect(runs.filter((r) => r.jobId === 'basemap').at(-1)).toMatchObject({ status: 'succeeded', result: expect.stringContaining('Planet build 20261010') });
    expect(runs.filter((r) => r.jobId === 'pack').at(-1)).toMatchObject({ status: 'succeeded', result: expect.stringContaining('Switched to the pack') });
    expect(readFileSync(join(dataDir, 'data-pack', 'basemap', 'part-0.png'), 'utf8')).toContain('/tiles/20261010.pmtiles');
  });

  it('keeps the pack in use when a source broke and says why, until a person switches anyway', async () => {
    const before = await meta();
    // The schools' register answered with almost nothing
    writeFileSync(join(dataDir, 'counts.json'), JSON.stringify({ addresses: 2_615_075, homeCells: 459_924, schools: 12 }));
    sources.zones = 4;
    await app.inject({ method: 'POST', url: '/api/jobs/plandata/run' });
    const runs = await settled();
    expect(runs.filter((r) => r.jobId === 'pack').at(-1)).toMatchObject({
      status: 'failed',
      message: `The new data was not switched in, because schools fell from 1,963 to 12 (−99 %). A source may be broken; the map keeps the data from ${before.pack}. Run "Pack the data" by hand to switch to it anyway.`,
    });
    expect((await meta()).pack).toBe(before.pack);

    await app.inject({ method: 'POST', url: '/api/jobs/pack/run' });
    const forced = (await settled()).filter((r) => r.jobId === 'pack').at(-1)!;
    expect(forced.status).toBe('succeeded');
    expect(forced.log).toContainEqual(expect.objectContaining({ level: 'warn', text: 'Switched in although schools fell from 1,963 to 12 (−99 %), because the pack was started by hand' }));
    expect((await meta()).pack).not.toBe(before.pack);
  });

  it('refuses a pack path that is not a pack', async () => {
    expect((await app.inject('/data-packs/../../etc/passwd')).statusCode).toBe(404);
    expect((await app.inject('/data-packs/20991231T000000Z-run1/data/meta.json')).json()).toMatchObject({ statusCode: 404, message: 'There is no data pack 20991231T000000Z-run1' });
    expect((await app.inject('/data-packs/not-a-pack/data/meta.json')).statusCode).toBe(400);
  });
});

describeWithDatabase('an install from before the jobs', () => {
  it('moves the old data pack aside when the jobs switch in their first, and still serves it by its own path', async () => {
    const database = await createTestDatabase();
    const server = await TestServer.start();
    const served = serveSources(server);
    const dataDir = mkdtempSync(join(tmpdir(), 'before-'));
    mkdirSync(join(dataDir, 'data-pack', 'data'), { recursive: true });
    writeFileSync(join(dataDir, 'data-pack', 'data', 'meta.json'), '{"built":"2026-10-07"}');
    const app = await buildApp({
      staticDir: '/nonexistent', dataPackDir: null, dataDir, databaseUrl: database.url, logLevel: false, jobPollSeconds: 0.5, timeZone: 'UTC',
      version: null, pipelinePython: FAKE_PYTHON, pmtiles: FAKE_PMTILES, grid: { cellMetres: 100, region: 'aarhus' },
      sourceUrls: served.urls, protomapsUrls: served.protomaps,
    });
    try {
      // A pack is there, so nothing starts by itself
      await wait(1_500);
      expect((await app.inject('/api/jobs')).json().runs).toEqual([]);
      expect((await app.inject('/data-pack/data/meta.json')).json()).toEqual({ built: '2026-10-07' });

      for (const job of ['osm', 'plandata', 'stil-schools', 'stil-daycare', 'ens', 'dst', 'noise', 'world']) {
        expect((await app.inject({ method: 'POST', url: `/api/jobs/${job}/run` })).statusCode).toBe(202);
      }
      for (let i = 0; i < 120 && !lstatSync(join(dataDir, 'data-pack')).isSymbolicLink(); i++) await wait(500);
      expect(readlinkSync(join(dataDir, 'data-pack'))).toMatch(/^packs\/\d{8}T\d{6}Z-run\d+$/);
      expect((await app.inject('/data-packs/00000000T000000Z-before-the-jobs/data/meta.json')).json()).toEqual({ built: '2026-10-07' });
      const pack = (await app.inject('/api/jobs')).json().runs.find((r: JobRun) => r.jobId === 'pack' && r.result?.startsWith('Switched'));
      expect(pack.log.map((l: { text: string }) => l.text)).toContain('Moving the data pack from before the jobs aside');
    } finally {
      await app.close();
      await server.close();
      await database.drop();
    }
  }, 90_000);
});
