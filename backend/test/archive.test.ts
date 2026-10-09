import { mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { migrate } from '../src/db/migrate.ts';
import { Archive } from '../src/pipeline/archive.ts';
import { createTestDatabase, describeWithDatabase } from './database.ts';
import { runContext } from './sources/context.ts';
import { TestServer } from './sources/server.ts';

describeWithDatabase('the raw archive', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let db: pg.Pool;
  let server: TestServer;
  let dataDir: string;
  let archive: Archive;

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

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'archive-'));
    archive = new Archive(db, dataDir);
    await db.query('delete from source_file');
    server.requests.length = 0;
  });

  const rows = async (name: string) => (await db.query(`select * from source_file where name = $1 order by id`, [name])).rows;
  const files = (dir: string): string[] => readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => relative(dataDir, join(e.parentPath, e.name))).sort();

  it('keeps a new file unchanged, and asks the server next time whether it changed', async () => {
    server.file('/zones.json', { content: '{"features":[1,2]}', etag: '"v1"', lastModified: 'Fri, 09 Oct 2026 03:40:39 GMT' });
    const { context } = await runContext(db);
    const first = await archive.download(context, { source: 'plandata', name: 'zones.json', url: `${server.url}/zones.json`, licence: 'CC BY 4.0' });
    expect(first.changed).toBe(true);
    expect(relative(dataDir, first.file.path)).toBe(`raw/plandata/${new Date().toISOString().slice(0, 10)}-run${context.runId}/zones.json`);
    expect(readFileSync(first.file.path, 'utf8')).toBe('{"features":[1,2]}');
    expect(first.file).toMatchObject({ bytes: 18, etag: '"v1"', lastModified: 'Fri, 09 Oct 2026 03:40:39 GMT', licence: 'CC BY 4.0' });
    expect(first.file.sha256).toBe(first.file.fingerprint);

    const again = await archive.download((await runContext(db)).context, { source: 'plandata', name: 'zones.json', url: `${server.url}/zones.json`, licence: 'CC BY 4.0' });
    expect(server.to('/zones.json')[1].headers).toMatchObject({ 'if-none-match': '"v1"', 'if-modified-since': 'Fri, 09 Oct 2026 03:40:39 GMT' });
    expect(again).toMatchObject({ changed: false, file: { id: first.file.id } });
    expect(await rows('zones.json')).toHaveLength(1);
    expect(files(dataDir)).toEqual([relative(dataDir, first.file.path)]);
  });

  it('keeps a changed file beside the old ones, and only the newest three', async () => {
    let version = 1;
    server.file('/data.csv', () => ({ content: `version ${version}`, etag: `"${version}"` }));
    const kept = [];
    for (; version <= 4; version++) {
      kept.push(await archive.download((await runContext(db)).context, { source: 'dst', name: 'data.csv', url: `${server.url}/data.csv`, licence: 'CC BY 4.0' }));
    }
    expect(kept.map((k) => k.changed)).toEqual([true, true, true, true]);
    const all = await rows('data.csv');
    expect(all.map((r) => r.pruned_at === null)).toEqual([false, true, true, true]);
    expect(files(dataDir)).toEqual(kept.slice(1).map((k) => relative(dataDir, k.file.path)));
    // The run's folder went with its last file
    expect(readdirSync(join(dataDir, 'raw', 'dst'))).toHaveLength(3);
    expect((await archive.newest('dst', 'data.csv'))?.id).toBe(kept[3].file.id);
  });

  it('does not keep the same content again when the server cannot tell', async () => {
    server.file('/same.json', { content: '[1]', etag: null });
    const first = await archive.download((await runContext(db)).context, { source: 'stil', name: 'same.json', url: `${server.url}/same.json`, licence: 'none' });
    const again = await archive.download((await runContext(db)).context, { source: 'stil', name: 'same.json', url: `${server.url}/same.json`, licence: 'none' });
    expect(again).toMatchObject({ changed: false, file: { id: first.file.id } });
    expect(new Date(again.file.checkedAt).getTime()).toBeGreaterThanOrEqual(new Date(first.file.checkedAt).getTime());
    expect(files(dataDir)).toHaveLength(1);
  });

  it('can leave out of the comparison what changes with every answer', async () => {
    let stamp = '2026-10-09T03:00:00Z';
    let features = [1];
    server.file('/wfs', () => ({ content: JSON.stringify({ timeStamp: stamp, features }), etag: null }));
    const spec = {
      source: 'plandata', name: 'zonekort.geojson', url: `${server.url}/wfs`, licence: 'CC BY 4.0',
      normalize: (content: Buffer) => JSON.stringify({ ...JSON.parse(content.toString()), timeStamp: undefined }),
    };
    await archive.download((await runContext(db)).context, spec);
    stamp = '2026-10-10T03:00:00Z';
    expect((await archive.download((await runContext(db)).context, spec)).changed).toBe(false);
    features = [1, 2];
    expect((await archive.download((await runContext(db)).context, spec)).changed).toBe(true);
  });

  it('fetches the whole file again when the kept one is gone, without calling it new', async () => {
    server.file('/lost.json', { content: '[1]', etag: '"same"' });
    const first = await archive.download((await runContext(db)).context, { source: 'stil', name: 'lost.json', url: `${server.url}/lost.json`, licence: 'none' });
    unlinkSync(first.file.path);
    const again = await archive.download((await runContext(db)).context, { source: 'stil', name: 'lost.json', url: `${server.url}/lost.json`, licence: 'none' });
    expect(server.to('/lost.json')[1].headers['if-none-match']).toBeUndefined();
    expect(again.changed).toBe(false);
    expect(readFileSync(again.file.path, 'utf8')).toBe('[1]');
  });

  it('keeps nothing from an error answer or from content that is not what it should be', async () => {
    const { context } = await runContext(db);
    await expect(archive.download(context, { source: 'x', name: 'missing', url: `${server.url}/missing`, licence: 'none' })).rejects.toThrow(/missing answered 404/);
    server.file('/wfs-error', { content: '<ExceptionReport>Too many features</ExceptionReport>' });
    await expect(archive.download(context, {
      source: 'x', name: 'zones.json', url: `${server.url}/wfs-error`, licence: 'none',
      check: (content) => { JSON.parse(content.toString()); return 'ok'; },
    })).rejects.toThrow(/wfs-error did not give what it should: Unexpected token/);
    expect(await rows('zones.json')).toEqual([]);
    expect(files(dataDir)).toEqual([]);
  });

  it('keeps files that belong together in one folder, all of them when one changed', async () => {
    const tmp = async (content: string) => {
      const path = await archive.tmpPath();
      writeFileSync(path, content);
      return path;
    };
    /** The parts of a shapefile with this content, as fetched. */
    const parts = (shape: string) => Promise.all([['noise.shp', shape], ['noise.dbf', 'table']].map(async ([name, content]) => ({
      spec: { source: 'noise', name, url: 'https://example.dk/noise.zip', licence: 'CC BY 4.0' }, tmp: await tmp(content),
    })));
    const first = await archive.keepFiles((await runContext(db)).context, await parts('shape 1'));
    expect(first.map((f) => f.changed)).toEqual([true, true]);
    const same = await archive.keepFiles((await runContext(db)).context, await parts('shape 1'));
    expect(same.map((f) => f.changed)).toEqual([false, false]);
    const changed = await archive.keepFiles((await runContext(db)).context, await parts('shape 2'));
    expect(changed.map((f) => f.changed)).toEqual([true, true]);
    // The unchanged table is kept again next to the shapes, so the shapefile is whole in one folder
    expect(new Set(changed.map((f) => join(f.file.path, '..'))).size).toBe(1);
    expect(readdirSync(archive.tmpDir)).toEqual([]);
  });

  it('stops a download when the run is cancelled, and leaves nothing behind', async () => {
    server.on('GET /slow', async (_request, response) => {
      response.writeHead(200, { 'content-length': '1000000' });
      response.write('x'.repeat(1000));
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      response.end();
    });
    const { context, cancel } = await runContext(db);
    const download = archive.download(context, { source: 'x', name: 'slow', url: `${server.url}/slow`, licence: 'none' });
    setTimeout(cancel, 200);
    await expect(download).rejects.toThrow(/abort/i);
    expect(readdirSync(archive.tmpDir)).toEqual([]);
    rmSync(dataDir, { recursive: true, force: true });
  });
});
