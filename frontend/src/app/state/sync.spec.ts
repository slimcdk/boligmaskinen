import { describe, expect, it } from 'vitest';
import { Block, Place, Profile, SavedMap, StoredMap, StoredPlace } from '@boligmaskinen/engine';
import { afterConflicts, afterSave, canonical, changesSince, EMPTY_BASE, hashOf, mapValue, merge, placeValue, SyncBase } from './sync';

const block = (id: string, extra: Partial<Block> = {}): Block => ({ id, name: id, code: 'ramp(forest, 300, 3000)', role: 'want', weight: 4, group: 'g1', ...extra });
const map = (id: string, name: string, blocks: Block[] = [block(`${id}-b`)]): SavedMap => ({ id, name, blocks, groups: [{ id: 'g1', name: 'Nature', enabled: true }] });
const stored = (m: SavedMap, version = 1): StoredMap => ({ ...m, version, updatedAt: '2026-10-09T12:00:00Z' });
const storedPlace = (p: Place, version = 1): StoredPlace => ({ ...p, version, updatedAt: '2026-10-09T12:00:00Z' });
const profile = (maps: StoredMap[], places: StoredPlace[] = [], epoch = 'e1'): Profile => ({ epoch, revision: 1, maps, places });
/** The base a browser has right after it saved these, at these versions. */
const baseOf = (maps: StoredMap[], places: StoredPlace[] = [], epoch = 'e1'): SyncBase => ({
  epoch,
  entities: Object.fromEntries([
    ...maps.map((m) => [`map:${m.id}`, { version: m.version, hash: hashOf(mapValue(m)) }] as const),
    ...places.map((p) => [`place:${p.id}`, { version: p.version, hash: hashOf(placeValue(p)) }] as const),
  ]),
});

describe('hashes of maps and places', () => {
  it('do not depend on the order of keys or on missing values', () => {
    expect(canonical({ b: 1, a: { d: [1, { f: 2, e: undefined }], c: true } })).toBe('{"a":{"c":true,"d":[1,{"f":2}]},"b":1}');
    expect(hashOf({ name: 'Family', blocks: [] })).toBe(hashOf({ blocks: [], name: 'Family', enabled: undefined }));
    expect(hashOf({ name: 'Family' })).not.toBe(hashOf({ name: 'Family 2' }));
  });
});

describe('what to save', () => {
  it('is what is new, changed or deleted since the server had it', () => {
    const family = stored(map('m1', 'Family'));
    const sea = stored(map('m2', 'Near the sea'), 3);
    const base = baseOf([family, sea]);
    const changed = { ...map('m1', 'Family'), name: 'Family, near work' };
    const fresh = map('m3', 'New');
    const pending = changesSince([changed, fresh], [{ id: 'p1', name: 'Work', lng: 10, lat: 56 }], base);
    expect(pending.map((p) => [p.change.kind, p.change.id, p.change.base, p.change.value === null ? 'delete' : 'save'])).toEqual([
      ['map', 'm1', 1, 'save'], ['map', 'm3', null, 'save'], ['place', 'p1', null, 'save'], ['map', 'm2', 3, 'delete'],
    ]);
    expect(changesSince([family, sea], [], base)).toEqual([]);
  });

  it('remembers the versions after a save, and sends again from the server\'s versions after a conflict', () => {
    const family = map('m1', 'Family');
    const pending = changesSince([family], [], EMPTY_BASE);
    const saved = afterSave({ ...EMPTY_BASE, epoch: 'e1' }, pending, { revision: 1, saved: [{ kind: 'map', id: 'm1', version: 1 }] });
    expect(saved.entities['map:m1']).toEqual({ version: 1, hash: hashOf(mapValue(family)) });
    expect(changesSince([family], [], saved)).toEqual([]);

    // Changed here, but another device saved version 2 first: the change goes again, from version 2
    const renamed = { ...family, name: 'Family 2' };
    const again = afterConflicts(saved, [{ kind: 'map', id: 'm1', version: 2 }]);
    expect(changesSince([renamed], [], again).map((p) => p.change.base)).toEqual([2]);
    // Deleted on the server meanwhile: it goes as a new map
    expect(changesSince([renamed], [], afterConflicts(saved, [{ kind: 'map', id: 'm1', version: null }])).map((p) => p.change.base)).toEqual([null]);
  });
});

describe('merging with the server', () => {
  it('sends everything from this browser to a server that has nothing', () => {
    const local = { maps: [map('m1', 'My map', [])], places: [{ id: 'p1', name: 'Work', lng: 10, lat: 56 }] };
    const merged = merge(local, EMPTY_BASE, profile([]));
    expect(merged.maps).toEqual(local.maps);
    expect(merged.base).toEqual({ epoch: 'e1', entities: {} });
    expect(changesSince(merged.maps, merged.places, merged.base)).toHaveLength(2);
  });

  it('leaves out the empty map a new browser starts with, when the server has maps', () => {
    const server = profile([stored(map('m1', 'Family'))]);
    const merged = merge({ maps: [map('mine', 'My map', [])], places: [] }, EMPTY_BASE, server);
    expect(merged.maps.map((m) => m.id)).toEqual(['m1']);
    expect(changesSince(merged.maps, merged.places, merged.base)).toEqual([]);
  });

  it('adds maps and places from a browser that met the server late, under names of their own', () => {
    const server = profile([stored(map('m1', 'My map'))], [storedPlace({ id: 'p1', name: 'Work', lng: 10, lat: 56 })]);
    const mine = map('m2', 'My map', [block('b9', { code: 'ramp(work_car, 15, 45)', template: 'place:p2', name: 'Work' })]);
    const merged = merge({ maps: [mine], places: [{ id: 'p2', name: 'Work', lng: 12, lat: 55 }] }, EMPTY_BASE, server);
    expect(merged.maps.map((m) => m.name)).toEqual(['My map', 'My map 2']);
    expect(merged.places.map((p) => p.name)).toEqual(['Work', 'Work 2']);
    // The place's values are renamed in the code of the map from here, as a rename does
    expect(merged.maps[1].blocks[0]).toMatchObject({ code: 'ramp(work_2_car, 15, 45)', name: 'Work 2' });
    expect(merged.notices).toEqual([{ type: 'renamed', name: 'Work', to: 'Work 2' }, { type: 'renamed', name: 'My map', to: 'My map 2' }]);
  });

  it('takes changes from other devices, and keeps the ones made here', () => {
    const family = stored(map('m1', 'Family'));
    const sea = stored(map('m2', 'Near the sea'));
    const base = baseOf([family, sea]);
    // Another device renamed Family; here Near the sea changed
    const server = profile([stored({ ...family, name: 'Family, near work' }, 2), sea]);
    const here = { ...map('m2', 'Near the sea'), name: 'By the sea' };
    const merged = merge({ maps: [map('m1', 'Family'), here], places: [] }, base, server);
    expect(merged.maps.map((m) => m.name)).toEqual(['Family, near work', 'By the sea']);
    expect(merged.notices).toEqual([{ type: 'updated', kind: 'map', id: 'm1', name: 'Family, near work' }]);
    expect(changesSince(merged.maps, merged.places, merged.base).map((p) => [p.change.id, p.change.base])).toEqual([['m2', 1]]);
  });

  it('keeps the change made here when both changed the same map, from the server\'s version, and says so', () => {
    const family = stored(map('m1', 'Family'));
    const server = profile([stored({ ...family, name: 'Theirs' }, 2)]);
    const merged = merge({ maps: [{ ...map('m1', 'Family'), name: 'Mine' }], places: [] }, baseOf([family]), server);
    expect(merged.maps[0].name).toBe('Mine');
    expect(merged.notices).toEqual([{ type: 'conflict', name: 'Mine' }]);
    expect(changesSince(merged.maps, merged.places, merged.base).map((p) => p.change.base)).toEqual([2]);
  });

  it('lets a map go that another device deleted, unless it was changed here since', () => {
    const family = stored(map('m1', 'Family'));
    const sea = stored(map('m2', 'Near the sea'));
    const base = baseOf([family, sea]);
    const merged = merge({ maps: [map('m1', 'Family'), { ...map('m2', 'Near the sea'), name: 'Changed here' }], places: [] }, base, profile([]));
    expect(merged.maps.map((m) => m.name)).toEqual(['Changed here']);
    expect(merged.notices).toEqual([{ type: 'deleted', kind: 'map', id: 'm1', name: 'Family' }, { type: 'conflict', name: 'Changed here' }]);
    // It goes to the server again, as a new map
    expect(changesSince(merged.maps, merged.places, merged.base).map((p) => [p.change.id, p.change.base])).toEqual([['m2', null]]);
  });

  it('keeps a deletion made here, and sends it from the server\'s version', () => {
    const family = stored(map('m1', 'Family'));
    const sea = stored(map('m2', 'Near the sea'));
    const merged = merge({ maps: [map('m1', 'Family')], places: [] }, baseOf([family, sea]), profile([family, stored(sea, 2)]));
    expect(merged.maps.map((m) => m.id)).toEqual(['m1']);
    expect(changesSince(merged.maps, merged.places, merged.base).map((p) => [p.change.id, p.change.base, p.change.value])).toEqual([['m2', 2, null]]);
  });

  it('treats a new database as a server it has not met', () => {
    const family = stored(map('m1', 'Family'));
    const merged = merge({ maps: [map('m1', 'Family')], places: [] }, baseOf([family], [], 'old'), profile([], [], 'new'));
    expect(merged.maps.map((m) => m.id)).toEqual(['m1']);
    expect(merged.notices).toEqual([]);
    expect(changesSince(merged.maps, merged.places, merged.base).map((p) => p.change.base)).toEqual([null]);
  });
});
