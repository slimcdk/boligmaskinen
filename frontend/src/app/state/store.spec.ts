import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formulaParams, LANGUAGE_VERSION } from '@boligmaskinen/engine';
import { Store } from './store';

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

  it('carries over what the first prototype saved', () => {
    localStorage.setItem('boligmaskinen.prototype.v1', JSON.stringify({ active: ['beach'], criteria: [], places: [] }));
    TestBed.resetTestingModule();
    expect(TestBed.inject(Store).blocks().map((b) => b.template)).toEqual(['beach']);
  });
});
