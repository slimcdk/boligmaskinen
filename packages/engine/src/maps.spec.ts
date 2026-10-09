import { describe, expect, it } from 'vitest';
import type { Block } from './blocks.ts';
import { activeBlocks, copyMap, emptyMap, groupNameFor, inGroup, OWN_GROUP, type SavedMap, tidyGroups, uniqueName } from './maps.ts';

const block = (id: string, extra: Partial<Block> = {}): Block => ({ id, name: id, code: 'ramp(forest, 300, 3000)', role: 'want', weight: 5, ...extra });

describe('groups of blocks', () => {
  it('start from the catalogue group, and the user\'s own blocks go together', () => {
    expect(groupNameFor({ group: 'Nature' })).toBe('Nature');
    expect(groupNameFor({ group: 'Examples' })).toBe(OWN_GROUP);
    expect(groupNameFor(undefined)).toBe(OWN_GROUP);
  });

  it('count only the blocks that are switched on, in groups that are switched on', () => {
    const groups = [{ id: 'g1', name: 'Nature', enabled: true }, { id: 'g2', name: 'Money', enabled: false }];
    const blocks = [block('a', { group: 'g1' }), block('b', { group: 'g2' }), block('c', { group: 'g1', enabled: false }), block('d')];
    expect(activeBlocks(blocks, groups).map((b) => b.id)).toEqual(['a', 'd']);
  });

  it('put a block in the group of a name, making it only when the map has none', () => {
    const first = inGroup(emptyMap('Family'), block('a'), 'Nature');
    expect(first.map.groups).toEqual([{ id: first.block.group, name: 'Nature', enabled: true }]);
    const second = inGroup({ ...first.map, blocks: [first.block] }, block('b'), 'nature');
    expect(second.block.group).toBe(first.block.group);
    expect(second.map.groups).toHaveLength(1);
  });

  it('are kept whole: every block in a group that exists, and no group without blocks', () => {
    const map: SavedMap = {
      id: 'm', name: 'Family',
      groups: [{ id: 'g1', name: 'Nature', enabled: true }, { id: 'g2', name: 'Empty', enabled: true }],
      blocks: [block('a', { group: 'g1' }), block('b'), block('c', { group: 'gone' })],
    };
    const tidy = tidyGroups(map);
    expect(tidy.groups.map((g) => g.name)).toEqual(['Nature', OWN_GROUP]);
    const own = tidy.groups[1].id;
    expect(tidy.blocks.map((b) => b.group)).toEqual(['g1', own, own]);
  });
});

describe('groups with the same name', () => {
  it('are one group, the first with its settings', () => {
    const map: SavedMap = {
      id: 'm', name: 'Family',
      groups: [{ id: 'g1', name: 'Forældre', enabled: false }, { id: 'g2', name: 'Nature', enabled: true }, { id: 'g3', name: 'forældre', enabled: true }],
      blocks: [block('a', { group: 'g1' }), block('b', { group: 'g2' }), block('c', { group: 'g3' })],
    };
    const tidy = tidyGroups(map);
    expect(tidy.groups).toEqual([{ id: 'g1', name: 'Forældre', enabled: false }, { id: 'g2', name: 'Nature', enabled: true }]);
    expect(tidy.blocks.map((b) => b.group)).toEqual(['g1', 'g2', 'g1']);
  });
});

describe('saved maps', () => {
  it('get a name that is not taken', () => {
    expect(uniqueName('Map', ['My map'])).toBe('Map');
    expect(uniqueName('Map', ['map', 'Map 2'])).toBe('Map 3');
  });

  it('copy into a map of their own, with new ids and the same blocks and groups', () => {
    const placed = inGroup(emptyMap('Family'), block('a'), 'Nature');
    const map = { ...placed.map, blocks: [placed.block] };
    const copy = copyMap(map, 'Family, near the sea');
    expect(copy.name).toBe('Family, near the sea');
    expect(copy.id).not.toBe(map.id);
    expect(copy.blocks[0].id).not.toBe('a');
    expect(copy.groups[0].id).not.toBe(map.groups[0].id);
    expect(copy.blocks[0].group).toBe(copy.groups[0].id);
    expect({ ...copy.blocks[0], id: 'a', group: map.groups[0].id }).toEqual(map.blocks[0]);
  });
});
