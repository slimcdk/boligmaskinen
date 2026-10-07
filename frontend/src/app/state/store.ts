import { Injectable, computed, effect, signal } from '@angular/core';
import {
  activeBlocks, Block, blockFrom, copyMap, DEFAULT_CRITERIA, DEFAULT_VIEW, emptyMap, formulaParams, groupNameFor, inGroup,
  LANGUAGE_VERSION, LIBRARY, MODES, Place, placeTemplate, placeValueName, renameValues, Role, SavedMap, setParam, templateOf,
  tidyGroups, turnAround, uniqueName, upgradeBlock, ViewState,
} from '@boligmaskinen/engine';
import { migrateV1, migrateV2, Migrated, SavedV1, SavedV2 } from './migrate';

const STORE_KEY = 'boligmaskinen.prototype.v4';
const OLDER_KEYS = { v3: 'boligmaskinen.prototype.v3', v2: 'boligmaskinen.prototype.v2', v1: 'boligmaskinen.prototype.v1' };

/** The first map's name, also for what earlier versions saved. */
export const FIRST_MAP = 'My map';

interface Saved {
  maps: SavedMap[];
  activeMap: string;
  places: Place[];
  view: ViewState;
}

/** What the prototype saved before there were maps: one list of blocks. */
interface SavedV3 {
  blocks: Block[];
  places: Place[];
  view?: ViewState;
}

/**
 * The saved maps, each with its blocks of the weighting in groups, the user's places (shared by
 * every map) and the map settings. Everything about blocks works on the map that is open.
 */
@Injectable({ providedIn: 'root' })
export class Store {
  /** The data layers of the catalogue, for the predefined blocks. */
  readonly catalogue = DEFAULT_CRITERIA;
  readonly maps = signal<SavedMap[]>([emptyMap(FIRST_MAP)]);
  private readonly activeMapId = signal(this.maps()[0].id);
  readonly places = signal<Place[]>([]);
  readonly view = signal<ViewState>({ ...DEFAULT_VIEW });
  /** True while the next map click should drop a new place. */
  readonly placing = signal(false);

  /** The map that is open. */
  readonly map = computed(() => this.maps().find((m) => m.id === this.activeMapId()) ?? this.maps()[0]);
  readonly blocks = computed(() => this.map().blocks);
  readonly groups = computed(() => this.map().groups);
  /** The blocks that count: switched on, in groups that are switched on. */
  readonly activeBlocks = computed(() => activeBlocks(this.blocks(), this.groups()));

  /** Predefined blocks in use on the open map, by template id. */
  readonly templatesInUse = computed(() => new Set(this.blocks().map((b) => b.template).filter((t): t is string => !!t)));

  constructor() {
    this.restore();
    effect(() => this.persist({ maps: this.maps(), activeMap: this.map().id, places: this.places(), view: this.view() }));
  }

  // ---- maps ----
  openMap(id: string): void {
    if (this.maps().some((m) => m.id === id)) this.activeMapId.set(id);
  }

  /** Start a new, empty map and open it. */
  newMap(name: string): void {
    const map = emptyMap(name.trim() || this.freeMapName('Map'));
    this.maps.update((list) => [...list, map]);
    this.activeMapId.set(map.id);
  }

  /** Copy the open map under a new name and open the copy. */
  duplicateMap(name: string): void {
    const map = copyMap(this.map(), name.trim() || this.freeMapName(`${this.map().name} (copy)`));
    this.maps.update((list) => [...list, map]);
    this.activeMapId.set(map.id);
  }

  renameMap(id: string, name: string): void {
    if (!name.trim()) return;
    this.maps.update((list) => list.map((m) => (m.id === id ? { ...m, name: name.trim() } : m)));
  }

  /** Delete a map; the last one stays, since there is always a map open. */
  deleteMap(id: string): void {
    const rest = this.maps().filter((m) => m.id !== id);
    if (!rest.length) return;
    if (this.map().id === id) this.activeMapId.set(rest[Math.max(0, this.maps().findIndex((m) => m.id === id) - 1)].id);
    this.maps.set(rest);
  }

  /** A map name not in use yet: the base, or the base with a number. */
  freeMapName(base: string): string {
    return uniqueName(base, this.maps().map((m) => m.name));
  }

  /** A name for a new group on the open map. */
  freeGroupName(base: string): string {
    return uniqueName(base, this.groups().map((g) => g.name));
  }

  private updateMap(change: (map: SavedMap) => SavedMap): void {
    const id = this.map().id;
    this.maps.update((list) => list.map((m) => (m.id === id ? tidyGroups(change(m)) : m)));
  }

  private updateBlocks(change: (blocks: Block[]) => Block[]): void {
    this.updateMap((m) => ({ ...m, blocks: change(m.blocks) }));
  }

  /** Change the blocks of every map, for what they share: the places. */
  private updateEveryMap(change: (blocks: Block[]) => Block[]): void {
    this.maps.update((list) => list.map((m) => tidyGroups({ ...m, blocks: change(m.blocks) })));
  }

  // ---- blocks ----
  /** Add a block to the open map: in its group when that exists, otherwise in the group of that name. */
  addBlock(block: Block, groupName = groupNameFor(templateOf(block, this.places()))): void {
    this.updateMap((m) => {
      const placed = block.group && m.groups.some((g) => g.id === block.group) ? { map: m, block } : inGroup(m, block, groupName);
      return { ...placed.map, blocks: [...placed.map.blocks, placed.block] };
    });
  }

  /** Add a predefined block. Blocks from the catalogue are only added once per map. */
  addTemplate(templateId: string): void {
    const template = LIBRARY.find((t) => t.id === templateId);
    if (!template) return;
    const once = DEFAULT_CRITERIA.some((c) => c.id === templateId);
    if (once && this.templatesInUse().has(templateId)) return;
    this.addBlock(blockFrom(template), groupNameFor(template));
  }

  /** Keep exactly these catalogue blocks (the catalogue dialog's checkboxes); other blocks stay. */
  setCatalogue(ids: string[]): void {
    const catalogue = new Set(DEFAULT_CRITERIA.map((c) => c.id));
    this.updateBlocks((list) => list.filter((b) => !b.template || !catalogue.has(b.template) || ids.includes(b.template)));
    for (const id of ids) this.addTemplate(id);
  }

  updateBlock(id: string, patch: Partial<Omit<Block, 'id'>>): void {
    this.updateBlocks((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  /**
   * Use a block as a preference or a requirement. It comes on with the change: only a requirement
   * has a switch, and a preference is turned off with its weight.
   */
  setRole(id: string, role: Role): void {
    this.updateBlock(id, { role, enabled: true });
  }

  /** Switch a block on or off; one that is off counts for nothing, but keeps its settings. */
  setEnabled(id: string, enabled: boolean): void {
    this.updateBlock(id, { enabled });
  }

  /** Move one of a block's controls: this rewrites the value in its code. */
  setParam(id: string, name: string, value: number): void {
    const block = this.blocks().find((b) => b.id === id);
    const param = block && formulaParams(block.code).find((p) => p.name === name);
    if (block && param) this.updateBlock(id, { code: setParam(block.code, param, value) });
  }

  /** Bring back a predefined block's original code, in the current version of the language. */
  resetBlock(id: string): void {
    const block = this.blocks().find((b) => b.id === id);
    const template = block && templateOf(block, this.places());
    if (!block || !template) return;
    // A block that was turned around also gets its own name back
    const name = template.opposite && block.name === template.opposite ? template.name : block.name;
    this.updateBlock(id, { code: template.code, language: LANGUAGE_VERSION, name });
  }

  /**
   * Turn a block around: full points at the other end of its ramp, such as noise instead of quiet.
   * A predefined block that still has its own name takes its opposite name, and back again.
   */
  turnAround(id: string): void {
    const block = this.blocks().find((b) => b.id === id);
    const code = block && turnAround(block.code);
    if (!block || !code) return;
    const template = templateOf(block, this.places());
    const name = !template?.opposite ? block.name
      : block.name === template.name ? template.opposite
      : block.name === template.opposite ? template.name
      : block.name;
    this.updateBlock(id, { code, name });
  }

  removeBlock(id: string): void {
    this.updateBlocks((list) => list.filter((b) => b.id !== id));
  }

  // ---- groups ----
  setGroupEnabled(id: string, enabled: boolean): void {
    this.updateMap((m) => ({ ...m, groups: m.groups.map((g) => (g.id === id ? { ...g, enabled } : g)) }));
  }

  setGroupCollapsed(id: string, collapsed: boolean): void {
    this.updateMap((m) => ({ ...m, groups: m.groups.map((g) => (g.id === id ? { ...g, collapsed } : g)) }));
  }

  renameGroup(id: string, name: string): void {
    if (!name.trim()) return;
    this.updateMap((m) => ({ ...m, groups: m.groups.map((g) => (g.id === id ? { ...g, name: name.trim() } : g)) }));
  }

  /** Move a block to another group on the open map. */
  moveToGroup(blockId: string, groupId: string): void {
    if (!this.groups().some((g) => g.id === groupId)) return;
    this.updateBlocks((list) => list.map((b) => (b.id === blockId ? { ...b, group: groupId } : b)));
  }

  /** Move a block to a new group of that name, or to the group of that name when there is one. */
  moveToNewGroup(blockId: string, name: string): void {
    this.updateMap((m) => {
      const block = m.blocks.find((b) => b.id === blockId);
      if (!block) return m;
      const placed = inGroup(m, block, name.trim() || uniqueName('New group', m.groups.map((g) => g.name)));
      return { ...placed.map, blocks: placed.map.blocks.map((b) => (b.id === blockId ? placed.block : b)) };
    });
  }

  // ---- places ----
  /** Drop a new place; it gets a block with the travel time to it, on the open map. */
  addPlace(lng: number, lat: number): Place {
    const used = new Set(this.places().map((p) => p.name));
    let n = 1;
    while (used.has(`Place ${n}`)) n++;
    const place: Place = { id: crypto.randomUUID(), name: `Place ${n}`, lng, lat };
    this.places.update((list) => [...list, place]);
    this.addPlaceBlock(place);
    return place;
  }

  private addPlaceBlock(place: Place): void {
    const template = placeTemplate(place);
    this.addBlock(blockFrom(template), groupNameFor(template));
  }

  /**
   * Give exactly these places a block on the open map (the catalogue dialog's checkboxes). Every
   * map shares the places, but each map has its own blocks for them.
   */
  setPlaceBlocks(ids: string[]): void {
    const keep = new Set(ids);
    this.updateBlocks((list) => list.filter((b) => !b.template?.startsWith('place:') || keep.has(b.template.slice(6))));
    for (const place of this.places()) {
      if (keep.has(place.id) && !this.templatesInUse().has(`place:${place.id}`)) this.addPlaceBlock(place);
    }
  }

  /** Move or rename a place. A new name renames its values in every block's code, on every map. */
  updatePlace(id: string, patch: Partial<Omit<Place, 'id'>>): void {
    const before = this.places().find((p) => p.id === id);
    if (!before) return;
    const after = { ...before, ...patch };
    this.places.update((list) => list.map((p) => (p.id === id ? after : p)));
    if (patch.name && patch.name !== before.name) {
      const renames = Object.fromEntries(MODES.map((m) => [placeValueName(before, m.mode), placeValueName(after, m.mode)]));
      this.updateEveryMap((list) => list.map((b) => ({
        ...b,
        code: renameValues(b.code, renames).replace(`Travel time to ${before.name},`, `Travel time to ${after.name},`),
        name: b.template === `place:${id}` && b.name === before.name ? after.name : b.name,
      })));
    }
  }

  /** Remove a place, and the blocks made for it on every map. */
  removePlace(id: string): void {
    this.places.update((list) => list.filter((p) => p.id !== id));
    this.updateEveryMap((list) => list.filter((b) => b.template !== `place:${id}`));
  }

  // ---- view ----
  setView(patch: Partial<ViewState>): void {
    this.view.update((v) => ({ ...v, ...patch }));
  }

  // ---- persistence ----
  private restore(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Saved | null;
      if (saved?.maps?.length) return this.apply(saved);
      // Carry over what the earlier prototypes saved
      const v3 = JSON.parse(localStorage.getItem(OLDER_KEYS.v3) ?? 'null') as SavedV3 | null;
      if (v3?.blocks) return this.applyBlocks(v3);
      const v2 = JSON.parse(localStorage.getItem(OLDER_KEYS.v2) ?? 'null') as SavedV2 | null;
      if (v2?.flow?.groups) return this.applyBlocks(migrateV2(v2, DEFAULT_CRITERIA));
      const v1 = JSON.parse(localStorage.getItem(OLDER_KEYS.v1) ?? 'null') as SavedV1 | null;
      if (v1) this.applyBlocks(migrateV1(v1, DEFAULT_CRITERIA));
    } catch {
      // Storage can be unavailable; the defaults are fine.
    }
  }

  private apply(saved: Saved): void {
    // Code saved for an older version of the block language is brought up to the current one
    this.maps.set(saved.maps.map((m) => tidyGroups({ ...m, blocks: m.blocks.map((b) => upgradeBlock(b).block) })));
    this.activeMapId.set(saved.maps.some((m) => m.id === saved.activeMap) ? saved.activeMap : saved.maps[0].id);
    this.places.set(saved.places ?? []);
    this.view.set({ ...DEFAULT_VIEW, ...(saved.view ?? {}) });
  }

  /** One list of blocks from before there were maps becomes the first map, in groups. */
  private applyBlocks(saved: SavedV3 | Migrated): void {
    this.places.set(saved.places ?? []);
    let map = emptyMap(FIRST_MAP);
    for (const block of saved.blocks) {
      const placed = inGroup(map, upgradeBlock(block).block, groupNameFor(templateOf(block, saved.places ?? [])));
      map = { ...placed.map, blocks: [...placed.map.blocks, placed.block] };
    }
    this.maps.set([map]);
    this.activeMapId.set(map.id);
    this.view.set({ ...DEFAULT_VIEW, ...(saved.view ?? {}) });
  }

  private persist(state: Saved): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch {
      // Ignore: storage is a convenience only.
    }
  }
}
