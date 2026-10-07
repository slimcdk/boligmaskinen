import { describe, expect, it } from 'vitest';
import { DEFAULT_CRITERIA, formulaParams } from '@boligmaskinen/engine';
import { migrateV1, migrateV2 } from './migrate';

const values = (code: string) => Object.fromEntries(formulaParams(code).map((p) => [p.name, p.value]));

describe('migrateV1', () => {
  it('turns saved criteria and places into blocks with the same settings', () => {
    const migrated = migrateV1({
      active: ['forest', 'zone'],
      criteria: [{ id: 'forest', role: 'want', weight: 1, full: 500, zero: 4000 }],
      places: [{ id: 'p1', name: 'Work', lng: 10, lat: 56, mode: 'bike', role: 'want', weight: 4, full: 10, zero: 40 }],
    }, DEFAULT_CRITERIA);
    const [forest, zone, work] = migrated.blocks;
    expect([forest.name, forest.weight, forest.template]).toEqual(['Forest', 1, 'forest']);
    expect(values(forest.code)).toEqual({ full: 500, zero: 4000 });
    expect([zone.role, values(zone.code)]).toEqual(['must', { byzone: 1, landzone: 1, sommerhus: 0 }]);
    expect([work.name, work.template, values(work.code)]).toEqual(['Work', 'place:p1', { travel: 2, full: 10, zero: 40 }]);
    expect(migrated.places).toEqual([{ id: 'p1', name: 'Work', lng: 10, lat: 56 }]);
  });
});

describe('migrateV2', () => {
  it('turns groups into the blocks they were made of', () => {
    const migrated = migrateV2({
      places: [{ id: 'p1', name: 'Work', lng: 10, lat: 56 }],
      flow: {
        groups: [
          {
            name: 'Forest', weight: 4, template: 'criterion:forest',
            nodes: [{ id: 'l', data: { type: 'layer', source: 'forest' } }, { id: 'c', data: { type: 'curve', full: 200, zero: 2000 } }],
            edges: [{ source: 'l', target: 'c' }],
          },
          {
            name: 'Planning zone', weight: 2, template: 'criterion:zone',
            nodes: [{ id: 'z', data: { type: 'layer', source: 'zone' } }, { id: 'r', data: { type: 'limit', allowed: [1] } }],
            edges: [{ source: 'z', target: 'r' }],
          },
          {
            name: 'Work', weight: 2, template: 'place',
            nodes: [{ id: 'p', data: { type: 'place', placeId: 'p1', mode: 'transit' } }, { id: 'c2', data: { type: 'curve', full: 20, zero: 60 } }],
            edges: [{ source: 'p', target: 'c2' }],
          },
          { name: 'Nearest water', weight: 1, nodes: [{ id: 'k', data: { type: 'code', code: 'clamp(1 - water / 2000)' } }], edges: [] },
        ],
      },
    }, DEFAULT_CRITERIA);
    expect(migrated.blocks.map((b) => [b.name, b.role, b.weight])).toEqual([
      ['Forest', 'want', 4], ['Planning zone', 'must', 2], ['Work', 'want', 2], ['Nearest water', 'want', 1],
    ]);
    expect(values(migrated.blocks[0].code)).toEqual({ full: 200, zero: 2000 });
    expect(values(migrated.blocks[1].code)).toEqual({ byzone: 1, landzone: 0, sommerhus: 0 });
    expect(values(migrated.blocks[2].code)).toEqual({ travel: 4, full: 20, zero: 60 });
    expect(migrated.blocks[3].code).toBe('clamp(1 - water / 2000)');
  });
});
