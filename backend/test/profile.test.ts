import { afterAll, beforeAll, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Block, Profile, ProfileChange } from '@boligmaskinen/engine';
import { buildApp } from '../src/app.ts';
import { createTestDatabase, describeWithDatabase } from './database.ts';

const forest: Block = { id: 'block-1', name: 'Forest', code: 'ramp(forest, 300, 3000)', role: 'want', weight: 4, template: 'forest', language: 1, group: 'group-1' };
const nature = { id: 'group-1', name: 'Nature', enabled: true };
const family = (name = 'Family', blocks = [forest]) => ({ name, blocks, groups: [nature] });

describeWithDatabase('the saved maps and places', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let app: FastifyInstance;

  const profile = async () => (await app.inject('/api/profile')).json() as Profile;
  const save = (changes: ProfileChange[]) => app.inject({ method: 'POST', url: '/api/profile/changes', payload: { changes } });

  beforeAll(async () => {
    database = await createTestDatabase();
    app = await buildApp({ staticDir: '/nonexistent', dataPackDir: null, databaseUrl: database.url, version: null, logLevel: false, jobs: [] });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await database?.drop();
  });

  it('start empty', async () => {
    expect(await profile()).toEqual({ epoch: expect.stringMatching(/^[0-9a-f-]{36}$/), revision: 0, maps: [], places: [] });
  });

  it('keep new maps and places, in the order they were made', async () => {
    const response = await save([
      { kind: 'map', id: 'map-a', base: null, value: family() },
      { kind: 'map', id: 'map-b', base: null, value: family('Near the sea', []) },
      { kind: 'place', id: 'place-a', base: null, value: { name: 'Work', lng: 10.2, lat: 56.15 } },
    ]);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      revision: 1,
      saved: [{ kind: 'map', id: 'map-a', version: 1 }, { kind: 'map', id: 'map-b', version: 1 }, { kind: 'place', id: 'place-a', version: 1 }],
    });
    const { maps, places, revision } = await profile();
    expect(revision).toBe(1);
    expect(maps.map((m) => [m.id, m.name, m.version])).toEqual([['map-a', 'Family', 1], ['map-b', 'Near the sea', 1]]);
    expect(maps[0].blocks).toEqual([forest]);
    expect(maps[0].groups).toEqual([nature]);
    expect(places).toEqual([{ id: 'place-a', name: 'Work', lng: 10.2, lat: 56.15, version: 1, updatedAt: expect.any(String) }]);
    // Ready for the travel-time jobs: the place is a point
    const point = await app.db!.query<{ wkt: string }>('select ST_AsText(geom) as wkt from place');
    expect(point.rows[0].wkt).toBe('POINT(10.2 56.15)');
  });

  it('raise the version with each change, and refuse a change made from an older one', async () => {
    expect((await save([{ kind: 'map', id: 'map-a', base: 1, value: family('Family, near work') }])).json()).toMatchObject({ revision: 2, saved: [{ version: 2 }] });

    // Another device still had version 1; nothing in its save is kept, not even the part that was fine
    const stale = await save([
      { kind: 'place', id: 'place-a', base: 1, value: { name: 'Office', lng: 10.2, lat: 56.15 } },
      { kind: 'map', id: 'map-a', base: 1, value: family('Old name') },
    ]);
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ statusCode: 409, conflicts: [{ kind: 'map', id: 'map-a', version: 2 }] });
    const after = await profile();
    expect(after.revision).toBe(2);
    expect(after.maps[0].name).toBe('Family, near work');
    expect(after.places[0].name).toBe('Work');

    // A new map whose id the server already has is a conflict too, as after a lost answer
    expect((await save([{ kind: 'map', id: 'map-b', base: null, value: family() }])).json()).toMatchObject({ conflicts: [{ id: 'map-b', version: 1 }] });
  });

  it('delete, and deleting what is gone is fine', async () => {
    expect((await save([{ kind: 'map', id: 'map-b', base: 2, value: null }])).json()).toMatchObject({ conflicts: [{ id: 'map-b', version: 1 }] });
    expect((await save([{ kind: 'map', id: 'map-b', base: 1, value: null }])).json()).toEqual({ revision: 3, saved: [{ kind: 'map', id: 'map-b', version: null }] });
    expect((await save([{ kind: 'map', id: 'map-b', base: 1, value: null }])).statusCode).toBe(200);
    expect((await profile()).maps.map((m) => m.id)).toEqual(['map-a']);
    // A change to a map another device deleted is a conflict, with no version
    expect((await save([{ kind: 'map', id: 'map-b', base: 1, value: family() }])).json()).toMatchObject({ conflicts: [{ id: 'map-b', version: null }] });
  });

  it('answer 304 when nothing changed since the ETag', async () => {
    const first = await app.inject('/api/profile');
    const etag = first.headers.etag as string;
    expect(etag).toMatch(/^"[0-9a-f-]{36}-\d+"$/);
    expect((await app.inject({ url: '/api/profile', headers: { 'if-none-match': etag } })).statusCode).toBe(304);
    await save([{ kind: 'place', id: 'place-b', base: null, value: { name: 'School', lng: 10.1, lat: 56.1 } }]);
    const changed = await app.inject({ url: '/api/profile', headers: { 'if-none-match': etag } });
    expect(changed.statusCode).toBe(200);
    expect(changed.headers.etag).not.toBe(etag);
  });

  it('check what they are given', async () => {
    const problems: ProfileChange[][] = [
      [{ kind: 'map', id: 'has space', base: null, value: family() }],
      [{ kind: 'map', id: 'map-c', base: null, value: { name: '', blocks: [], groups: [] } }],
      [{ kind: 'map', id: 'map-c', base: null, value: { name: 'Places', lng: 1, lat: 2 } as never }],
      [{ kind: 'place', id: 'place-c', base: null, value: { name: 'Far away', lng: 200, lat: 2 } }],
      [{ kind: 'map', id: 'map-c', base: null, value: family('Bad block', [{ ...forest, role: 'maybe' as never }]) }],
      [{ kind: 'map', id: 'map-c', base: null, value: family() }, { kind: 'map', id: 'map-c', base: null, value: family() }],
    ];
    for (const changes of problems) expect((await save(changes)).statusCode, JSON.stringify(changes)).toBe(400);
  });
});

it('without a database, says that saving maps needs one', async () => {
  const app = await buildApp({ staticDir: '/nonexistent', dataPackDir: null, databaseUrl: null, version: null, logLevel: false });
  const response = await app.inject('/api/profile');
  expect(response.statusCode).toBe(503);
  expect(response.json().message).toBe('Saving maps on the server needs the database. Set DATABASE_URL.');
  expect((await app.inject({ method: 'POST', url: '/api/profile/changes', payload: { changes: [] } })).statusCode).toBe(503);
  await app.close();
});
