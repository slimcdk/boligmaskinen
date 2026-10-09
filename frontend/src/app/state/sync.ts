import {
  EntityVersion, MapValue, MODES, Place, placeValueName, PlaceValue, Profile, ProfileChange, ProfileSaved, renameValues, SavedMap,
  uniqueName,
} from '@boligmaskinen/engine';

/**
 * What this browser knows of the server's maps and places: the version of each on the server, and a
 * hash of what the server has. A map or place whose hash differs from its own is changed here and
 * not saved yet; one the server has no entry for is new here.
 */
export interface SyncBase {
  /** The server's profile these belong to; another epoch means another (or a new) database. */
  epoch: string | null;
  /** By `map:<id>` and `place:<id>`. */
  entities: Record<string, { version: number; hash: string }>;
}

export const EMPTY_BASE: SyncBase = { epoch: null, entities: {} };

/** Something the user should hear about after a merge or a save. */
export type SyncNotice =
  | { type: 'conflict'; name: string }
  | { type: 'renamed'; name: string; to: string }
  | { type: 'updated' | 'deleted'; kind: 'map' | 'place'; id: string; name: string };

/** A change to send, with the hash of what it sends (null for a deletion). */
export interface PendingChange {
  change: ProfileChange;
  hash: string | null;
}

export const mapValue = (map: SavedMap): MapValue => ({ name: map.name, blocks: map.blocks, groups: map.groups });
export const placeValue = (place: Place): PlaceValue => ({ name: place.name, lng: place.lng, lat: place.lat });

/** JSON with the keys in order and without undefined, so equal values give equal text. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  });
}

/** A short hash of a value: cyrb53 (public domain, by bryc) of its canonical JSON. */
export function hashOf(value: unknown): string {
  const text = canonical(value);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ char, 2654435761);
    h2 = Math.imul(h2 ^ char, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const keyOf = (kind: 'map' | 'place', id: string) => `${kind}:${id}`;

/** What to send so the server has what this browser has. */
export function changesSince(maps: SavedMap[], places: Place[], base: SyncBase): PendingChange[] {
  const pending: PendingChange[] = [];
  const here = new Set<string>();
  const add = (kind: 'map' | 'place', id: string, value: MapValue | PlaceValue) => {
    const key = keyOf(kind, id);
    here.add(key);
    const hash = hashOf(value);
    const known = base.entities[key];
    if (known?.hash !== hash) pending.push({ change: { kind, id, base: known?.version ?? null, value } as ProfileChange, hash });
  };
  for (const map of maps) add('map', map.id, mapValue(map));
  for (const place of places) add('place', place.id, placeValue(place));
  for (const [key, known] of Object.entries(base.entities)) {
    if (here.has(key)) continue;
    const at = key.indexOf(':');
    pending.push({ change: { kind: key.slice(0, at) as 'map', id: key.slice(at + 1), base: known.version, value: null }, hash: null });
  }
  return pending;
}

/** The base after a save went through. */
export function afterSave(base: SyncBase, pending: PendingChange[], answer: ProfileSaved): SyncBase {
  const entities = { ...base.entities };
  for (const { change, hash } of pending) {
    const saved = answer.saved.find((s) => s.kind === change.kind && s.id === change.id);
    if (!saved) continue;
    const key = keyOf(change.kind, change.id);
    if (saved.version === null || hash === null) delete entities[key];
    else entities[key] = { version: saved.version, hash };
  }
  return { ...base, entities };
}

/**
 * The base after the server refused a save because another device got there first. The changes made
 * here win: they are sent again from the server's versions. A map or place the server no longer has
 * is sent as a new one, and a deletion of it is done.
 */
export function afterConflicts(base: SyncBase, conflicts: EntityVersion[]): SyncBase {
  const entities = { ...base.entities };
  for (const conflict of conflicts) {
    const key = keyOf(conflict.kind, conflict.id);
    if (conflict.version === null) delete entities[key];
    else entities[key] = { version: conflict.version, hash: entities[key]?.hash ?? '' };
  }
  return { ...base, entities };
}

export interface Merged {
  maps: SavedMap[];
  places: Place[];
  base: SyncBase;
  notices: SyncNotice[];
}

/**
 * This browser's maps and places merged with the server's, one map or place at a time:
 * - what changed only on the server is taken from it, and what changed only here stays and is saved;
 * - what changed in both places keeps this browser's change, and says so;
 * - what another device deleted goes, unless it was changed here since;
 * - what is new here is added, under a name of its own when the server has one like it. An empty
 *   map from before this browser met the server is left out, since the server has maps.
 */
export function merge(local: { maps: SavedMap[]; places: Place[] }, base: SyncBase, server: Profile): Merged {
  const fresh = base.epoch !== server.epoch;
  const known = fresh ? {} : base.entities;
  const entities: SyncBase['entities'] = {};
  const notices: SyncNotice[] = [];

  function list<T extends { id: string; name: string }, S extends T & { version: number; updatedAt: string }>(
    kind: 'map' | 'place', mine: T[], theirs: S[], value: (item: T) => unknown, keepNew: (item: T) => boolean,
  ): { items: T[]; fromHere: Set<string>; renamed: Map<string, { from: string; to: string }> } {
    const items: T[] = [];
    // The ones whose content is this browser's
    const fromHere = new Set<string>();
    const renamed = new Map<string, { from: string; to: string }>();
    const byId = new Map(mine.map((item) => [item.id, item]));
    for (const stored of theirs) {
      const { version, updatedAt: _updatedAt, ...rest } = stored;
      const item = rest as unknown as T;
      const key = keyOf(kind, item.id);
      const hash = hashOf(value(item));
      const here = byId.get(item.id);
      const before = known[key];
      entities[key] = { version, hash };
      if (!here) {
        // Deleted here since the last save, and it stays deleted; otherwise new from another device
        if (!before) items.push(item);
        else if (before.version !== version) notices.push({ type: 'conflict', name: item.name });
        continue;
      }
      const hashHere = hashOf(value(here));
      if (before && hashHere === before.hash) {
        items.push(item);
        if (hash !== hashHere) notices.push({ type: 'updated', kind, id: item.id, name: item.name });
      } else {
        items.push(here);
        fromHere.add(here.id);
        if (before && before.version !== version && hash !== hashHere) notices.push({ type: 'conflict', name: here.name });
      }
    }
    const names = items.map((item) => item.name);
    for (const here of mine) {
      if (theirs.some((stored) => stored.id === here.id)) continue;
      const before = known[keyOf(kind, here.id)];
      if (before) {
        // Another device deleted it; it stays if it was changed here since
        if (hashOf(value(here)) === before.hash) notices.push({ type: 'deleted', kind, id: here.id, name: here.name });
        else {
          items.push(here);
          fromHere.add(here.id);
          notices.push({ type: 'conflict', name: here.name });
        }
        continue;
      }
      if (!keepNew(here)) continue;
      const name = uniqueName(here.name, names);
      if (name !== here.name) {
        renamed.set(here.id, { from: here.name, to: name });
        notices.push({ type: 'renamed', name: here.name, to: name });
      }
      names.push(name);
      items.push({ ...here, name });
      fromHere.add(here.id);
    }
    return { items, fromHere, renamed };
  }

  const places = list('place', local.places, server.places, placeValue, () => true);
  const maps = list('map', local.maps, server.maps, mapValue, (map) => !fresh || !server.maps.length || map.blocks.length > 0);

  // A place from here that was renamed is renamed in the code of the maps from here too, as when
  // the user renames a place (Store.updatePlace)
  let mapItems = maps.items;
  for (const [id, { from, to }] of places.renamed) {
    const fromPlace = { id, name: from, lng: 0, lat: 0 };
    const toPlace = { ...fromPlace, name: to };
    const renames = Object.fromEntries(MODES.map((m) => [placeValueName(fromPlace, m.mode), placeValueName(toPlace, m.mode)]));
    mapItems = mapItems.map((map) => (!maps.fromHere.has(map.id) ? map : {
      ...map,
      blocks: map.blocks.map((block) => ({
        ...block,
        code: renameValues(block.code, renames).replace(`Travel time to ${from},`, `Travel time to ${to},`),
        name: block.template === `place:${id}` && block.name === from ? to : block.name,
      })),
    }));
  }
  return { maps: mapItems, places: places.items, base: { epoch: server.epoch, entities }, notices };
}
