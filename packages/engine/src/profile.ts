/**
 * The user's maps and places as the server keeps them (backend/src/profile), shared by the
 * backend and the frontend. There is one profile per instance until there are users.
 *
 * Every map and place has a version that the server raises with each change. A change names the
 * version it was made from (its base), and the server refuses it when another device has changed
 * the map or place since: the device then learns the current version, and decides.
 */
import type { SavedMap } from './maps.ts';
import type { Place } from './types.ts';

/** What the server keeps of a map: everything but its id. */
export type MapValue = Pick<SavedMap, 'name' | 'blocks' | 'groups'>;
/** What the server keeps of a place. */
export type PlaceValue = Pick<Place, 'name' | 'lng' | 'lat'>;

export interface StoredMap extends SavedMap {
  version: number;
  updatedAt: string;
}

export interface StoredPlace extends Place {
  version: number;
  updatedAt: string;
}

export interface Profile {
  /** Made with the database, so a device can tell a new server from the one it knew. */
  epoch: string;
  /** Counts every change; the profile's ETag is the epoch and the revision. */
  revision: number;
  /** In the order they were made. */
  maps: StoredMap[];
  places: StoredPlace[];
}

/**
 * One map or place to save. `base` is the version it was changed from, or null for a new one; a
 * null `value` deletes it.
 */
export type ProfileChange =
  | { kind: 'map'; id: string; base: number | null; value: MapValue | null }
  | { kind: 'place'; id: string; base: number | null; value: PlaceValue | null };

/** A map or place and its version on the server now; null when the server has none. */
export interface EntityVersion {
  kind: ProfileChange['kind'];
  id: string;
  version: number | null;
}

/** The answer to a save: the new revision, and the new version of each change. */
export interface ProfileSaved {
  revision: number;
  saved: EntityVersion[];
}

/** The answer when another device got there first (409): nothing was saved. */
export interface ProfileConflicts {
  conflicts: EntityVersion[];
}

