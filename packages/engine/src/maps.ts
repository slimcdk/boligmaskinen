/**
 * Saved maps, and the groups of blocks in them.
 *
 * - A map is a named weighting with its own blocks, in groups. The user's places are shared by
 *   all maps.
 * - A group is a named set of blocks that can be switched off together. It has no weight of its
 *   own: switching it off is the same as leaving its blocks out, and the rest are weighted as
 *   before.
 */
import { type Block, newId } from './blocks.ts';
import type { BlockTemplate } from './library.ts';

export interface BlockGroup {
  id: string;
  name: string;
  enabled: boolean;
  /** Folded together in the panel. */
  collapsed?: boolean;
}

export interface SavedMap {
  id: string;
  name: string;
  blocks: Block[];
  groups: BlockGroup[];
}

/** The group for the user's own blocks and the examples. */
export const OWN_GROUP = 'My blocks';

/** The group a predefined block starts in: its catalogue group, or OWN_GROUP. */
export function groupNameFor(template: Pick<BlockTemplate, 'group'> | null | undefined): string {
  return !template || template.group === 'Examples' ? OWN_GROUP : template.group;
}

/** The blocks that count: switched on, in a group that is switched on. */
export function activeBlocks(blocks: Block[], groups: BlockGroup[]): Block[] {
  const off = new Set(groups.filter((g) => !g.enabled).map((g) => g.id));
  return blocks.filter((b) => b.enabled !== false && !(b.group && off.has(b.group)));
}

/** The name, or the name with a number when it is taken: "Map", "Map 2", "Map 3". Case does not count. */
export function uniqueName(base: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((name) => name.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  let n = 2;
  while (used.has(`${base} ${n}`.toLowerCase())) n++;
  return `${base} ${n}`;
}

export function emptyMap(name: string): SavedMap {
  return { id: newId('map'), name, blocks: [], groups: [] };
}

/** The map with the block in the group of that name, which is made when the map has none. */
export function inGroup(map: SavedMap, block: Block, groupName: string): { map: SavedMap; block: Block } {
  let group = map.groups.find((g) => g.name.toLowerCase() === groupName.toLowerCase());
  const groups = group ? map.groups : [...map.groups, (group = { id: newId('group'), name: groupName, enabled: true })];
  return { map: { ...map, groups }, block: { ...block, group: group.id } };
}

/**
 * The map with its groups made whole: every block is in a group that exists (OWN_GROUP when it
 * was in none), and a group without blocks is gone. Groups keep their order.
 */
export function tidyGroups(map: SavedMap): SavedMap {
  let current = map;
  const known = new Set(map.groups.map((g) => g.id));
  const blocks = map.blocks.map((block) => {
    if (block.group && known.has(block.group)) return block;
    const placed = inGroup(current, block, OWN_GROUP);
    current = placed.map;
    known.add(placed.block.group!);
    return placed.block;
  });
  const used = new Set(blocks.map((b) => b.group));
  return { ...current, blocks, groups: current.groups.filter((g) => used.has(g.id)) };
}

/** A copy of the map under a new name, with new ids, so the two can change apart. */
export function copyMap(map: SavedMap, name: string): SavedMap {
  const groupIds = new Map(map.groups.map((g) => [g.id, newId('group')]));
  return {
    id: newId('map'),
    name,
    groups: map.groups.map((g) => ({ ...g, id: groupIds.get(g.id)! })),
    blocks: map.blocks.map((b) => ({ ...b, id: newId('block'), group: b.group && groupIds.get(b.group) })),
  };
}
