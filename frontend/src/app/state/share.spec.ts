import { describe, expect, it } from 'vitest';
import { Block, DEFAULT_VIEW, SavedMap } from '@boligmaskinen/engine';
import { decodeShare, encodeShare, importShared, placesUsed } from './share';

const WORK = { id: 'p-work', name: 'Work', lng: 10.2, lat: 56.15 };
const GYM = { id: 'p-gym', name: 'Gym', lng: 10.1, lat: 56.1 };
const block = (id: string, extra: Partial<Block>): Block => ({ id, name: id, code: 'ramp(forest, 300, 3000)', role: 'want', weight: 4, group: 'g1', ...extra });
const MAP: SavedMap = {
  id: 'm1', name: 'Family', groups: [{ id: 'g1', name: 'Nature', enabled: true }],
  blocks: [
    block('b1', {}),
    block('b2', { name: 'Work', template: 'place:p-work', code: '// Travel time to Work, by car\nramp(work_car, 15, 45)' }),
    block('b3', { code: 'min(work_bike, 60) < 30' , role: 'must' }),
  ],
};

describe('a map as a link', () => {
  it('takes the places its blocks use, and no others', () => {
    expect(placesUsed(MAP, [WORK, GYM]).map((p) => p.name)).toEqual(['Work']);
  });

  it('comes back from the link as it went in, in a short link', async () => {
    const view = { ...DEFAULT_VIEW, palette: 'azure' as const, show: 'top' as const, top: 15 };
    const code = await encodeShare(MAP, [WORK, GYM], view);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThan(600);
    expect(await decodeShare(code)).toEqual({ v: 1, name: 'Family', blocks: MAP.blocks, groups: MAP.groups, places: [WORK], view });
  });

  it('says when a link is broken', async () => {
    await expect(decodeShare('not-a-map')).rejects.toThrow('The link is broken: the map in it cannot be read');
    const wrong = await encodeShare({ ...MAP, blocks: [{ ...MAP.blocks[0], role: 'maybe' as never }] }, [], DEFAULT_VIEW);
    await expect(decodeShare(wrong)).rejects.toThrow('The link is broken: it does not hold a map this app knows');
  });
});

describe('adding a shared map', () => {
  let n = 0;
  const id = (prefix: string) => `${prefix}-${++n}`;

  it('adds a copy under a name of its own, and uses a place that is here already', async () => {
    const shared = await decodeShare(await encodeShare(MAP, [WORK], DEFAULT_VIEW));
    const { map, places } = importShared(shared, [MAP], [WORK], id);
    expect(map.name).toBe('Family 2');
    expect(map.id).not.toBe('m1');
    expect(places).toEqual([WORK]);
    expect(map.blocks[1]).toMatchObject({ name: 'Work', template: 'place:p-work', code: '// Travel time to Work, by car\nramp(work_car, 15, 45)' });
    // The groups and blocks have ids of their own, and the blocks are still in their group
    expect(map.groups[0].id).not.toBe('g1');
    expect(map.blocks.every((b) => b.group === map.groups[0].id)).toBe(true);
  });

  it('brings in a place it does not know, under a name of its own, and renames the code to it', async () => {
    const shared = await decodeShare(await encodeShare(MAP, [WORK], DEFAULT_VIEW));
    // Here, "Work" is somewhere else
    const mine = { id: 'mine', name: 'Work', lng: 12.5, lat: 55.7 };
    const { map, places } = importShared(shared, [], [mine], id);
    const added = places.find((p) => p.id !== 'mine')!;
    expect(added).toMatchObject({ name: 'Work 2', lng: 10.2, lat: 56.15 });
    expect(map.blocks[1]).toMatchObject({ name: 'Work 2', template: `place:${added.id}`, code: '// Travel time to Work 2, by car\nramp(work_2_car, 15, 45)' });
    expect(map.blocks[2].code).toBe('min(work_2_bike, 60) < 30');
  });
});
