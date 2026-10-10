import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import type { Job, JobRun } from '../src/jobs/types.ts';
import { FETCH_JOBS } from '../src/pipeline/sources.ts';
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
  /**
   * Waits until nothing has waited or run for a while, and returns the runs, oldest first. A job
   * that finishes queues the next one just after, so one quiet look is not enough.
   */
  async function settled(timeout = 60_000): Promise<JobRun[]> {
    const end = Date.now() + timeout;
    let quiet = 0;
    for (;;) {
      await wait(500);
      const { runs } = await list();
      quiet = runs.some((r) => r.status === 'queued' || r.status === 'running') ? 0 : quiet + 1;
      if (quiet === 3) return runs.reverse();
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
  }, 60_000);

  it('has no data pack at first, and says so', async () => {
    const response = await app.inject('/data-pack/data/meta.json');
    // The jobs may have finished already on a fast machine
    if (response.statusCode === 404) expect(response.json().message).toBe('There is no data pack yet: the data jobs build it');
  }, 60_000);

  it('fetches every source, then builds the grid, the basemap and the pack, and serves it', async () => {
    const runs = await settled();
    const outcome = (jobId: string) => runs.filter((r) => r.jobId === jobId).map((r) => `${r.status}: ${r.result ?? r.message}`);
    for (const job of Object.keys(FETCH_JOBS)) {
      expect(runs.find((r) => r.jobId === job)).toMatchObject({ status: 'succeeded', trigger: 'schedule', log: expect.arrayContaining([expect.objectContaining({ text: 'There is no data pack yet, so every source is fetched now' })]) });
    }
    // The grid waited for the sources and was built once, when the last of them was in
    expect(outcome('grid').filter((o) => o.includes(' cells '))).toEqual(['succeeded: aarhus: 2 × 2 cells of 200 m, 459,924 with homes']);
    expect(outcome('basemap')).toEqual([expect.stringMatching(/^succeeded: Planet build 20261009 up to zoom 12, \d+ B$/)]);
    expect(outcome('pack').filter((o) => o.includes('Switched'))).toHaveLength(1);
    // The road network follows the OSM extract and the timetables, with the timetables beside it; as
    // both start it, a second run may wait in the queue and be dropped
    expect(outcome('roads').filter((o) => !o.startsWith('cancelled: The queue already had'))).toEqual(['succeeded: 7,200,839 nodes: 8,565,564 edges by car, 12,979,152 by bike, 15,345,026 on foot; public transport of 2026-10-06: 1,168,243 connections']);
    expect(runs.filter((r) => r.status === 'failed')).toEqual([]);
    expect(outcome('data-pack')).toEqual(['succeeded: 1 layer']);

    const served = await meta();
    expect(served).toMatchObject({ pack: expect.stringMatching(/^\d{8}T\d{6}Z-run\d+$/), cellMetres: 200, region: { id: 'aarhus' } });
    expect(readlinkSync(join(dataDir, 'data-pack'))).toBe(`packs/${served.pack}`);
    // The pack carries the licence texts of the fonts and icons it serves
    expect((await app.inject('/data-pack/licences/noto-fonts-OFL.txt')).body).toContain('OPEN FONT LICENSE');
    expect((await app.inject('/data-pack/licences/icons-MIT.md')).body).toContain('MIT');
    const current = await app.inject('/data-pack/data/meta.json');
    expect(current.headers['cache-control']).toBe('no-cache');
    // Every kept pack has a path of its own, which never changes
    const own = await app.inject(`/data-packs/${served.pack}/basemap/part-0.png`);
    expect(own.statusCode).toBe(200);
    expect(own.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(own.body).toMatch(/^tiles of .*"region":"aarhus".* from http:\/\/127\.0\.0\.1:\d+\/tiles\/20261009\.pmtiles$/);
  }, 60_000);

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
  }, 60_000);

  it('cuts a new basemap on its schedule when Protomaps has a newer build', async () => {
    sources.planetBuild = '20261010.pmtiles';
    await app.inject({ method: 'POST', url: '/api/jobs/basemap/run' });
    const runs = await settled();
    expect(runs.filter((r) => r.jobId === 'basemap').at(-1)).toMatchObject({ status: 'succeeded', result: expect.stringContaining('Planet build 20261010') });
    expect(runs.filter((r) => r.jobId === 'pack').at(-1)).toMatchObject({ status: 'succeeded', result: expect.stringContaining('Switched to the pack') });
    expect(readFileSync(join(dataDir, 'data-pack', 'basemap', 'part-0.png'), 'utf8')).toContain('/tiles/20261010.pmtiles');
  }, 60_000);

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
  }, 60_000);

  it('refuses a pack path that is not a pack', async () => {
    expect((await app.inject('/data-packs/../../etc/passwd')).statusCode).toBe(404);
    expect((await app.inject('/data-packs/20991231T000000Z-run1/data/meta.json')).json()).toMatchObject({ statusCode: 404, message: 'There is no data pack 20991231T000000Z-run1' });
    expect((await app.inject('/data-packs/not-a-pack/data/meta.json')).statusCode).toBe(400);
  }, 60_000);
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

      for (const job of Object.keys(FETCH_JOBS)) {
        expect((await app.inject({ method: 'POST', url: `/api/jobs/${job}/run` })).statusCode).toBe(202);
      }
      for (let i = 0; i < 120 && !lstatSync(join(dataDir, 'data-pack')).isSymbolicLink(); i++) await wait(500);
      expect(readlinkSync(join(dataDir, 'data-pack'))).toMatch(/^packs\/\d{8}T\d{6}Z-run\d+$/);
      expect((await app.inject('/data-packs/00000000T000000Z-before-the-jobs/data/meta.json')).json()).toEqual({ built: '2026-10-07' });
      // The pack's run gets its result as it finishes, a moment after it switched the pack in
      let pack: JobRun | undefined;
      for (let i = 0; i < 40 && !pack; i++) {
        pack = ((await app.inject('/api/jobs')).json().runs as JobRun[]).find((r) => r.jobId === 'pack' && r.result?.startsWith('Switched'));
        if (!pack) await wait(250);
      }
      expect(pack?.log.map((l) => l.text)).toContain('Moving the data pack from before the jobs aside');
    } finally {
      await app.close();
      await server.close();
      await database.drop();
    }
  }, 90_000);
});

describeWithDatabase('an install that fetches already', () => {
  it('fetches a source that came with a new version at once, builds the road network, and nothing else', async () => {
    const database = await createTestDatabase();
    const server = await TestServer.start();
    const served = serveSources(server);
    const dataDir = mkdtempSync(join(tmpdir(), 'update-'));
    mkdirSync(join(dataDir, 'data-pack', 'data'), { recursive: true });
    writeFileSync(join(dataDir, 'data-pack', 'data', 'meta.json'), '{"built":"2026-10-09"}');
    const setup = await buildApp({ staticDir: '/nonexistent', dataPackDir: null, databaseUrl: database.url, version: null, logLevel: false, jobs: [] });
    // Every source but the air, the plans and the protected areas was fetched before the update
    for (const source of Object.keys(FETCH_JOBS).filter((id) => !['air', 'plans', 'protected'].includes(id))) {
      await setup.db!.query(
        `insert into source_file (source, name, url, licence, path, bytes, sha256, fingerprint) values ($1, 'file', 'https://example.dk', 'CC BY 4.0', $2, 1, 'x', 'x')`,
        [source, `raw/${source}/file`],
      );
    }
    await setup.close();
    const app = await buildApp({
      staticDir: '/nonexistent', dataPackDir: null, dataDir, databaseUrl: database.url, logLevel: false, jobPollSeconds: 0.5, timeZone: 'UTC',
      version: null, pipelinePython: FAKE_PYTHON, pmtiles: FAKE_PMTILES, sourceUrls: served.urls, protomapsUrls: served.protomaps,
    });
    try {
      const runs = (await app.inject('/api/jobs')).json().runs as JobRun[];
      expect(runs.map((r) => [r.jobId, r.log[0].text])).toEqual([
        ['roads', 'There is no road network yet, so it is built now'],
        ['protected', 'A source that has not been fetched yet, so it is fetched now'],
        ['plans', 'A source that has not been fetched yet, so it is fetched now'],
        ['air', 'A source that has not been fetched yet, so it is fetched now'],
      ]);
    } finally {
      await app.close();
      await server.close();
      await database.drop();
    }
  }, 60_000);
});
