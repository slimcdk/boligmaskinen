import { mkdtempSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../src/db/migrate.ts';
import type { JobDefinition, JobOutcome } from '../src/jobs/types.ts';
import { NEEDS_DATA_DIR, type SourceUrls, sourceJobs } from '../src/pipeline/sources.ts';
import { createTestDatabase, describeWithDatabase } from './database.ts';
import { runContext } from './sources/context.ts';
import { TestServer } from './sources/server.ts';

const FAKE_PYTHON = fileURLToPath(new URL('./sources/fake-python.sh', import.meta.url));
const zip = (text: string) => Buffer.concat([Buffer.from('PK\u0003\u0004', 'latin1'), Buffer.from(text)]);

describe('the source jobs without DATA_DIR', () => {
  it('say what they need', () => {
    const jobs = sourceJobs({ dataDir: null, python: FAKE_PYTHON, revision: 'abc' });
    expect(jobs.map((j) => j.id)).toEqual(['osm', 'plandata', 'stil-schools', 'stil-daycare', 'ens', 'dst', 'noise', 'world']);
    expect(jobs.every((j) => j.blocked === NEEDS_DATA_DIR && !j.run)).toBe(true);
  });
});

describeWithDatabase('the source jobs', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let db: pg.Pool;
  let server: TestServer;
  let dataDir: string;
  let jobs: Map<string, JobDefinition>;

  beforeAll(async () => {
    database = await createTestDatabase();
    db = new pg.Pool({ connectionString: database.url });
    await migrate(db);
    server = await TestServer.start();
  }, 60_000);

  afterAll(async () => {
    await server?.close();
    await db?.end();
    await database?.drop();
  });

  function setUp(revision = 'abc'): void {
    const base = server.url;
    const urls: SourceUrls = {
      osm: `${base}/osm/denmark-latest.osm.pbf`, zones: `${base}/wfs`, institutions: `${base}/institutions`, daycare: `${base}/Eksport.aspx`,
      turbinesPage: `${base}/data-oversigt`, statbank: `${base}/statbank`, noise: `${base}/noise/2022_noise_shp.zip`, naturalEarth: `${base}/ne`,
    };
    jobs = new Map(sourceJobs({ dataDir, python: FAKE_PYTHON, revision, urls }).map((j) => [j.id, j]));
  }

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'sources-'));
    await db.query('delete from source_file');
    server.requests.length = 0;
    setUp();
  });

  async function run(jobId: string): Promise<JobOutcome & { log: string[] }> {
    const { context, lines } = await runContext(db, jobId);
    const outcome = (await jobs.get(jobId)!.run!(context)) ?? {};
    return { ...outcome, log: lines.map((l) => l.text) };
  }
  const calls = () => readFileSync(join(dataDir, 'calls.log'), 'utf8').split('\n').filter(Boolean).map((l) => l.split(' ')[0]);

  it('OpenStreetMap: fetches the extract and takes the layers out of it, once per extract', async () => {
    server.file('/osm/denmark-latest.osm.pbf', { content: 'pbf of 2026-10-09', etag: '"osm-1"' });
    const first = await run('osm');
    expect(first).toMatchObject({ changed: true, result: '2,615,038 addresses, 120,000 roads, 50,000 forests', bytes: 17 });
    expect(readFileSync(join(dataDir, 'work/osm/current/layers.gpkg'), 'utf8')).toBe('layers of pbf of 2026-10-09');
    expect(JSON.parse(readFileSync(join(dataDir, 'work/osm/current/made-from.json'), 'utf8')).revision).toBe('abc');

    const again = await run('osm');
    expect(again).toMatchObject({ changed: false, result: expect.stringMatching(/^Unchanged since \d{4}-\d\d-\d\d$/) });
    expect(calls()).toEqual(['osm']);
    // A new version of the app takes the layers out again, without fetching the extract again
    setUp('def');
    expect(await run('osm')).toMatchObject({ changed: true });
    expect(calls()).toEqual(['osm', 'osm']);
    expect(server.to('/osm/denmark-latest.osm.pbf').map((r) => r.headers['if-none-match'] ?? null)).toEqual([null, '"osm-1"', '"osm-1"']);
  });

  it('Planning zones: a new time stamp alone is no change, and an error page is not kept', async () => {
    let answer = JSON.stringify({ type: 'FeatureCollection', timeStamp: '2026-10-09T03:30:00Z', features: [{}, {}] });
    server.file('/wfs', () => ({ content: answer, etag: null }));
    expect(await run('plandata')).toMatchObject({ changed: true, result: '2 polygons' });
    answer = answer.replace('2026-10-09', '2026-10-10');
    expect(await run('plandata')).toMatchObject({ changed: false });
    answer = '<ows:ExceptionReport>Could not do it</ows:ExceptionReport>';
    await expect(run('plandata')).rejects.toThrow(/did not give what it should: not JSON: <ows:ExceptionReport>/);
  });

  it('Schools: counts the active schools', async () => {
    server.file('/institutions', {
      content: JSON.stringify([
        { institutionTypeId: 1012, activeCodeName: 'Aktiv' }, { institutionTypeId: 1013, activeCodeName: 'Aktiv' },
        { institutionTypeId: 1012, activeCodeName: 'Ophørt' }, { institutionTypeId: 1020, activeCodeName: 'Aktiv' },
      ]),
    });
    expect(await run('stil-schools')).toMatchObject({ changed: true, result: '2 active schools among 4 institutions' });
    expect(server.to('/institutions')[0].headers['accept']).toBe('application/json');
  });

  it('Daycare: posts the export form back with its state and cookie', async () => {
    server.on('GET /Eksport.aspx', (_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html', 'set-cookie': 'ASP.NET_SessionId=abc123; path=/; HttpOnly' });
      response.end('<input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="state+/=" /><input id="__VIEWSTATEGENERATOR" value="GEN" /><input id="__EVENTVALIDATION" value="valid" />');
    });
    server.on('POST /Eksport.aspx', (request, response) => {
      const form = new URLSearchParams(request.body);
      const ok = form.get('__VIEWSTATE') === 'state+/=' && form.get('__EVENTTARGET') === 'ctl00$ContentPlaceHolder1$LinkButtonAnv' && request.headers['cookie'] === 'ASP.NET_SessionId=abc123';
      response.writeHead(ok ? 200 : 400, { 'content-type': 'text/csv' });
      response.end(ok ? '﻿navn;aktivitetsstatus;geoBredde;geoLaengde\r\nSolsikken;Aktiv;56.1;10.2\r\nLukket;Ophørt;56.2;10.1\r\n' : 'bad form');
    });
    expect(await run('stil-daycare')).toMatchObject({ changed: true, result: '1 active units' });
  });

  it('Wind turbines: finds the newest upload on the data page', async () => {
    server.on('GET /data-oversigt', (_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' }).end(`
        <a class="link-download" href="/media/8748/download">Vinddata (ultimo 08 2026) - Uploadet september 2026</a>
        <a class="link-download" href="/media/8746/download">Historiske vinddata (ultimo 2022)</a>`);
    });
    server.file('/media/8748/download', { content: zip('turbines') });
    expect(await run('ens')).toMatchObject({ changed: true, result: 'Vinddata (ultimo 08 2026) - Uploadet september 2026' });
    const [file] = (await db.query(`select url from source_file where source = 'ens'`)).rows;
    expect(file.url).toBe(`${server.url}/media/8748/download`);

    server.on('GET /data-oversigt', (_request, response) => {
      response.writeHead(200).end('<p>Nothing here</p>');
    });
    await expect(run('ens')).rejects.toThrow(/Found no link to "Vinddata" on .*; the page may have changed/);
  });

  it('Municipal statistics: asks for every area in the newest period of each table', async () => {
    server.on('POST /statbank', (request, response) => {
      const { table } = JSON.parse(request.body) as { table: string };
      const period = { PSKAT: '2026', STRAF22: '2025', FOLK1A: '2026K3' }[table];
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ dataset: { dimension: { Tid: { category: { index: { [period!]: 0 } } } }, value: [1, 2] } }));
    });
    expect(await run('dst')).toMatchObject({ changed: true, result: 'PSKAT 2026, STRAF22 2025, FOLK1A 2026K3' });
    const bodies = server.to('/statbank').map((r) => JSON.parse(r.body) as { table: string; variables: { code: string; values: string[] }[] });
    expect(bodies.map((b) => b.table)).toEqual(['PSKAT', 'STRAF22', 'FOLK1A']);
    expect(bodies.every((b) => b.variables[0].values[0] === '*' && b.variables.at(-1)!.values[0] === '(1)')).toBe(true);
    expect(await run('dst')).toMatchObject({ changed: false });
  });

  it('Road noise: takes the map out of the archive only when the archive changed', async () => {
    let etag = '"noise-1"';
    server.file('/noise/2022_noise_shp.zip', () => ({ content: 'a big zip', etag }));
    expect(await run('noise')).toMatchObject({ changed: true, result: 'The road noise map, 36 B' });
    const kept = (await db.query(`select name, path from source_file where source = 'noise' order by name`)).rows;
    expect(kept.map((r) => r.name)).toEqual(['eu_2022_vej_4m.dbf', 'eu_2022_vej_4m.prj', 'eu_2022_vej_4m.shp', 'eu_2022_vej_4m.shx']);
    expect(new Set(kept.map((r) => r.path.split('/').slice(0, -1).join('/'))).size).toBe(1);

    expect(await run('noise')).toMatchObject({ changed: false });
    expect(server.to('/noise/2022_noise_shp.zip').map((r) => r.method)).toEqual(['HEAD', 'HEAD']);
    // A new archive with the same road noise map in it
    etag = '"noise-2"';
    expect(await run('noise')).toMatchObject({ changed: false });
    writeFileSync(join(dataDir, 'noise.txt'), 'new noise');
    etag = '"noise-3"';
    expect(await run('noise')).toMatchObject({ changed: true });
    expect(calls()).toEqual(['remote-zip', 'remote-zip', 'remote-zip']);
  });

  it('World map: builds the layers from Natural Earth when a file changed', async () => {
    for (const name of ['physical/ne_50m_land', 'physical/ne_50m_lakes', 'cultural/ne_50m_admin_0_boundary_lines_land', 'cultural/ne_50m_admin_0_countries', 'cultural/ne_50m_populated_places_simple']) {
      server.file(`/ne/${name}.zip`, { content: zip(name) });
    }
    expect(await run('world')).toMatchObject({ changed: true, result: '5 layers: land, lakes, borders, countries and places' });
    expect(readlinkSync(join(dataDir, 'work/world/current'))).toMatch(/^\d{8}T\d{6}Z-run\d+$/);
    expect(await run('world')).toMatchObject({ changed: false });
    expect(calls()).toEqual(['world']);
  });
});
