import {
  Block, BlockGroup, copyMap, MODES, Place, placeValueName, renameValues, SavedMap, uniqueName, ViewState,
} from '@boligmaskinen/engine';

/**
 * A map as a link: its blocks and groups, the view it is shown with, and the places its blocks
 * use, compressed into the address after #share=. Opening the link adds a copy of the map; it
 * never changes the maps that are there.
 */
export interface SharedMap {
  v: 1;
  name: string;
  blocks: Block[];
  groups: BlockGroup[];
  places: Place[];
  view: ViewState;
}

/** The places the map's blocks use: a place's own blocks, and code that reads its travel times. */
export function placesUsed(map: SavedMap, places: Place[]): Place[] {
  return places.filter((place) => {
    const values = MODES.map((m) => placeValueName(place, m.mode));
    return map.blocks.some((b) => b.template === `place:${place.id}` || values.some((name) => new RegExp(`\\b${name}\\b`).test(b.code)));
  });
}

const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (text: string) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function through(stream: CompressionStream | DecompressionStream, bytes: Uint8Array): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  // A broken input fails the reading below; the writing's own failure says the same
  writer.write(bytes as Uint8Array<ArrayBuffer>).then(() => writer.close()).catch(() => undefined);
  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  for (let read = await reader.read(); !read.done; read = await reader.read()) chunks.push(read.value);
  const out = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
  chunks.reduce((at, c) => (out.set(c, at), at + c.length), 0);
  return out;
}

export async function encodeShare(map: SavedMap, places: Place[], view: ViewState): Promise<string> {
  const shared: SharedMap = { v: 1, name: map.name, blocks: map.blocks, groups: map.groups, places: placesUsed(map, places), view };
  return toBase64Url(await through(new CompressionStream('deflate-raw'), new TextEncoder().encode(JSON.stringify(shared))));
}

/** The map in a link, or an error that says the link is broken. */
export async function decodeShare(text: string): Promise<SharedMap> {
  let shared: SharedMap;
  try {
    shared = JSON.parse(new TextDecoder().decode(await through(new DecompressionStream('deflate-raw'), fromBase64Url(text)))) as SharedMap;
  } catch {
    throw new Error('The link is broken: the map in it cannot be read');
  }
  const ok = shared?.v === 1 && typeof shared.name === 'string' && Array.isArray(shared.blocks) && Array.isArray(shared.groups)
    && Array.isArray(shared.places) && typeof shared.view === 'object'
    && shared.blocks.every((b) => typeof b?.code === 'string' && typeof b.name === 'string' && (b.role === 'want' || b.role === 'must') && typeof b.weight === 'number')
    && shared.places.every((p) => typeof p?.name === 'string' && Number.isFinite(p.lng) && Number.isFinite(p.lat));
  if (!ok) throw new Error('The link is broken: it does not hold a map this app knows');
  return shared;
}

/**
 * What adding a shared map does to the maps and places that are there: a copy of the map under a
 * name of its own, and its places. A place that is here already, by name and position, is used as
 * it is; another one comes in under a name of its own, and the map's code is renamed to it.
 */
export function importShared(shared: SharedMap, maps: SavedMap[], places: Place[], newId: (prefix: string) => string): { map: SavedMap; places: Place[] } {
  const added: Place[] = [];
  const names = places.map((p) => p.name);
  let blocks = shared.blocks;
  for (const theirs of shared.places) {
    const same = places.find((p) => p.name === theirs.name && Math.abs(p.lng - theirs.lng) < 1e-5 && Math.abs(p.lat - theirs.lat) < 1e-5);
    const place = same ?? { id: newId('place'), name: uniqueName(theirs.name, names), lng: theirs.lng, lat: theirs.lat };
    if (!same) {
      added.push(place);
      names.push(place.name);
    }
    const renames = Object.fromEntries(MODES.map((m) => [placeValueName(theirs, m.mode), placeValueName(place, m.mode)]));
    blocks = blocks.map((b) => ({
      ...b,
      code: place.name === theirs.name ? b.code : renameValues(b.code, renames).replace(`Travel time to ${theirs.name},`, `Travel time to ${place.name},`),
      name: b.template === `place:${theirs.id}` && b.name === theirs.name ? place.name : b.name,
      template: b.template === `place:${theirs.id}` ? `place:${place.id}` : b.template,
    }));
  }
  const map = copyMap({ id: 'shared', name: shared.name, blocks, groups: shared.groups }, uniqueName(shared.name, maps.map((m) => m.name)));
  return { map, places: [...places, ...added] };
}
