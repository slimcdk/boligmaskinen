import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formulaParams, LANGUAGE_VERSION, OWN_GROUP } from '@boligmaskinen/engine';
import { FIRST_MAP, Store } from './store';

const values = (code: string) => Object.fromEntries(formulaParams(code).map((p) => [p.name, p.value]));

describe('Store', () => {
  let store: Store;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    store = TestBed.inject(Store);
  });

  afterEach(() => localStorage.clear());

  it('adds a block from the catalogue only once', () => {
    store.addTemplate('forest');
    store.addTemplate('forest');
    store.addTemplate('empty');
    store.addTemplate('empty');
    expect(store.blocks().map((b) => b.template)).toEqual(['forest', 'empty', 'empty']);
  });

  it('keeps exactly the checked catalogue blocks and leaves the others', () => {
    store.addTemplate('forest');
    store.addTemplate('empty');
    store.setCatalogue(['noise']);
    expect(store.blocks().map((b) => b.template)).toEqual(['empty', 'noise']);
  });

  it('rewrites the code when a control moves, and can reset it', () => {
    store.addTemplate('forest');
    const id = store.blocks()[0].id;
    store.setParam(id, 'full', 500);
    expect(values(store.blocks()[0].code)).toEqual({ full: 500, zero: 3000 });
    store.resetBlock(id);
    expect(values(store.blocks()[0].code)).toEqual({ full: 300, zero: 3000 });
  });

  it('turns a block around under its opposite name, back again, and resets it', () => {
    store.addTemplate('noise');
    const id = store.blocks()[0].id;
    store.turnAround(id);
    expect(store.blocks()[0]).toMatchObject({ name: 'Noisy' });
    expect(values(store.blocks()[0].code)).toEqual({ full: 65, zero: 45 });
    store.turnAround(id);
    expect(store.blocks()[0]).toMatchObject({ name: 'Quiet' });
    expect(values(store.blocks()[0].code)).toEqual({ full: 45, zero: 65 });
    // A name of the user's own stays, and Reset brings back the direction
    store.turnAround(id);
    store.updateBlock(id, { name: 'Lively streets' });
    store.turnAround(id);
    expect(store.blocks()[0].name).toBe('Lively streets');
    store.turnAround(id);
    store.resetBlock(id);
    expect(values(store.blocks()[0].code)).toEqual({ full: 45, zero: 65 });
    store.updateBlock(id, { name: 'Noisy' });
    store.resetBlock(id);
    expect(store.blocks()[0].name).toBe('Quiet');
  });

  it('gives a new place a block, renames its values with the place and removes it with the place', () => {
    const place = store.addPlace(10, 56);
    store.addBlock({ id: 'custom', name: 'Mine', code: `ramp(min(${'place_1_car'}, school), 0, 30)`, role: 'want', weight: 2 });
    expect(store.blocks()[0]).toMatchObject({ name: 'Place 1', template: `place:${place.id}` });
    store.updatePlace(place.id, { name: 'Arbejde' });
    expect(store.blocks()[0].name).toBe('Arbejde');
    expect(store.blocks()[0].code).toContain('choice(1, arbejde_car, arbejde_bike, arbejde_walk, arbejde_train)');
    expect(store.blocks()[1].code).toBe('ramp(min(arbejde_car, school), 0, 30)');
    store.removePlace(place.id);
    expect(store.blocks().map((b) => b.id)).toEqual(['custom']);
  });

  it('remembers the blocks after a reload', () => {
    store.addTemplate('noise');
    store.setParam(store.blocks()[0].id, 'zero', 60);
    TestBed.tick();
    TestBed.resetTestingModule();
    const reloaded = TestBed.inject(Store);
    expect(values(reloaded.blocks()[0].code)).toEqual({ full: 45, zero: 60 });
  });

  it('brings blocks saved for an older version of the block language up to date when it loads them', () => {
    localStorage.setItem('boligmaskinen.prototype.v3', JSON.stringify({
      blocks: [{ id: 'b1', name: 'Forest', code: 'ramp(forest, 300, 3000)', role: 'want', weight: 5 }],
      places: [],
      view: {},
    }));
    TestBed.resetTestingModule();
    expect(TestBed.inject(Store).blocks()[0]).toMatchObject({ code: 'ramp(forest, 300, 3000)', language: LANGUAGE_VERSION });
  });

  it('keeps the blocks of each map apart', () => {
    store.addTemplate('forest');
    const first = store.map().id;
    store.newMap('Near the sea');
    expect(store.map().name).toBe('Near the sea');
    expect(store.blocks()).toEqual([]);
    store.addTemplate('water');
    store.openMap(first);
    expect(store.blocks().map((b) => b.template)).toEqual(['forest']);
    expect(store.maps().map((m) => m.name)).toEqual([FIRST_MAP, 'Near the sea']);
  });

  it('duplicates, renames and deletes maps, but never the last one', () => {
    store.addTemplate('forest');
    store.duplicateMap('Family');
    expect(store.map().name).toBe('Family');
    const family = store.map().id;
    store.setParam(store.blocks()[0].id, 'full', 500);
    store.renameMap(family, 'Family, near work');
    expect(store.map().name).toBe('Family, near work');
    // The copy changes on its own
    store.openMap(store.maps()[0].id);
    expect(values(store.blocks()[0].code)).toEqual({ full: 300, zero: 3000 });
    // Deleting the open map opens another
    store.deleteMap(store.map().id);
    expect(store.maps().map((m) => m.name)).toEqual(['Family, near work']);
    expect(store.map().id).toBe(family);
    store.deleteMap(family);
    expect(store.maps()).toHaveLength(1);
    expect(store.freeMapName('Family, near work')).toBe('Family, near work 2');
  });

  it('puts blocks in their catalogue group, and a group that is off leaves its blocks out', () => {
    store.addTemplate('forest');
    store.addTemplate('noise');
    store.addTemplate('empty');
    expect(store.groups().map((g) => g.name)).toEqual(['Nature', 'Peace and quiet', OWN_GROUP]);
    const nature = store.groups()[0].id;
    store.setGroupEnabled(nature, false);
    expect(store.activeBlocks().map((b) => b.template)).toEqual(['noise', 'empty']);
    store.setGroupEnabled(nature, true);
    expect(store.activeBlocks()).toHaveLength(3);
  });

  it('moves blocks to other groups and new ones, and drops a group when it is empty', () => {
    store.addTemplate('forest');
    store.addTemplate('water');
    store.addTemplate('noise');
    const [forest, water] = store.blocks();
    const quiet = store.groups()[1].id;
    store.moveToGroup(forest.id, quiet);
    store.moveToNewGroup(water.id, 'Weekends');
    expect(store.groups().map((g) => g.name)).toEqual(['Peace and quiet', 'Weekends']);
    expect(store.blocks().map((b) => store.groups().find((g) => g.id === b.group)!.name)).toEqual(['Peace and quiet', 'Weekends', 'Peace and quiet']);
    store.renameGroup(quiet, 'Calm');
    store.setGroupCollapsed(quiet, true);
    expect(store.groups()[0]).toMatchObject({ name: 'Calm', collapsed: true, enabled: true });
    expect(store.freeGroupName('Weekends')).toBe('Weekends 2');
  });

  it('joins a group renamed to the name of another, so no two share a name', () => {
    store.addTemplate('forest');
    store.addTemplate('noise');
    const [nature, quiet] = store.groups();
    store.renameGroup(quiet.id, ' nature ');
    expect(store.groups()).toMatchObject([{ id: nature.id, name: 'Nature' }]);
    expect(store.blocks().map((b) => b.group)).toEqual([nature.id, nature.id]);
  });

  it('puts a new block where its kind already is, also in a group the user renamed', () => {
    store.addPlace(10, 56);
    const places = store.groups()[0];
    store.renameGroup(places.id, 'Family');
    store.addPlace(11, 56);
    expect(store.groups().map((g) => g.name)).toEqual(['Family']);
    store.addTemplate('forest');
    store.renameGroup(store.groups()[1].id, 'Outdoors');
    store.addTemplate('beach');
    expect(store.groups().map((g) => g.name)).toEqual(['Family', 'Outdoors']);
  });

  it('switches a requirement off, and on again when it becomes a preference', () => {
    store.addTemplate('zone');
    const id = store.blocks()[0].id;
    store.setEnabled(id, false);
    expect(store.activeBlocks()).toEqual([]);
    store.setRole(id, 'want');
    expect(store.activeBlocks().map((b) => b.id)).toEqual([id]);
  });

  it('shares the places between maps, each with its own blocks for them', () => {
    const place = store.addPlace(10, 56);
    const first = store.map().id;
    store.newMap('Second');
    expect(store.places()).toHaveLength(1);
    expect(store.blocks()).toEqual([]);
    store.setPlaceBlocks([place.id]);
    expect(store.blocks()[0]).toMatchObject({ name: 'Place 1', template: `place:${place.id}` });
    expect(store.groups().map((g) => g.name)).toEqual(['Your places']);
    // A new name and a removed place reach every map
    store.updatePlace(place.id, { name: 'Arbejde' });
    expect(store.blocks()[0].name).toBe('Arbejde');
    store.openMap(first);
    expect(store.blocks()[0].name).toBe('Arbejde');
    store.removePlace(place.id);
    expect(store.maps().map((m) => m.blocks.length)).toEqual([0, 0]);
    // Unchecked in the catalogue, only this map's block goes
    const other = store.addPlace(11, 56);
    store.setPlaceBlocks([]);
    expect(store.blocks()).toEqual([]);
    expect(store.places().map((p) => p.id)).toEqual([other.id]);
  });

  it('remembers the maps, their groups and which map is open after a reload', () => {
    store.addTemplate('forest');
    store.newMap('Second');
    store.addTemplate('noise');
    store.setGroupEnabled(store.groups()[0].id, false);
    TestBed.tick();
    TestBed.resetTestingModule();
    const reloaded = TestBed.inject(Store);
    expect(reloaded.maps().map((m) => m.name)).toEqual([FIRST_MAP, 'Second']);
    expect(reloaded.map().name).toBe('Second');
    expect(reloaded.groups()).toMatchObject([{ name: 'Peace and quiet', enabled: false }]);
    expect(reloaded.activeBlocks()).toEqual([]);
  });

  it('turns the blocks saved before there were maps into the first map, in groups', () => {
    localStorage.setItem('boligmaskinen.prototype.v3', JSON.stringify({
      blocks: [
        { id: 'b1', name: 'Forest', code: 'ramp(forest, 300, 3000)', role: 'want', weight: 5, template: 'forest' },
        { id: 'b2', name: 'Mine', code: 'ramp(noise, 45, 65)', role: 'want', weight: 1 },
      ],
      places: [],
      view: { palette: 'azure' },
    }));
    TestBed.resetTestingModule();
    const reloaded = TestBed.inject(Store);
    expect(reloaded.maps().map((m) => m.name)).toEqual([FIRST_MAP]);
    expect(reloaded.groups().map((g) => g.name)).toEqual(['Nature', OWN_GROUP]);
    expect(reloaded.blocks().map((b) => b.id)).toEqual(['b1', 'b2']);
    expect(reloaded.view().palette).toBe('azure');
  });

  it('takes the maps and places the server has, with what it knows of them, and keeps them after a reload', () => {
    const synced = { epoch: 'e1', entities: { 'map:m1': { version: 2, hash: 'h' } } };
    store.replaceAll({ maps: [{ id: 'm1', name: 'Family', blocks: [{ id: 'b1', name: 'Forest', code: 'ramp(forest, 300, 3000)', role: 'want', weight: 4 }], groups: [] }], places: [], synced });
    // Put in a group, and in the current version of the language, like everything loaded
    expect(store.groups().map((g) => g.name)).toEqual([OWN_GROUP]);
    expect(store.blocks()[0].language).toBe(LANGUAGE_VERSION);
    TestBed.tick();
    TestBed.resetTestingModule();
    const reloaded = TestBed.inject(Store);
    expect(reloaded.synced()).toEqual(synced);
    expect(reloaded.map().name).toBe('Family');
    // There is always a map
    reloaded.replaceAll({ maps: [], places: [], synced });
    expect(reloaded.maps().map((m) => m.name)).toEqual([FIRST_MAP]);
  });

  it('gives a new place an id that works without HTTPS', () => {
    expect(store.addPlace(10, 56).id).toMatch(/^place-[0-9a-f]{24}$/);
  });

  it('carries over what the first prototype saved', () => {
    localStorage.setItem('boligmaskinen.prototype.v1', JSON.stringify({ active: ['beach'], criteria: [], places: [] }));
    TestBed.resetTestingModule();
    expect(TestBed.inject(Store).blocks().map((b) => b.template)).toEqual(['beach']);
  });
});
