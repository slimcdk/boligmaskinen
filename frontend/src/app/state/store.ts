import { Injectable, computed, effect, signal } from '@angular/core';
import {
  Block, blockFrom, DEFAULT_CRITERIA, DEFAULT_VIEW, formulaParams, LANGUAGE_VERSION, LIBRARY, MODES, Place, placeTemplate,
  placeValueName, renameValues, setParam, templateOf, turnAround, upgradeBlock, ViewState,
} from '@boligmaskinen/engine';
import { migrateV1, migrateV2, Migrated, SavedV1, SavedV2 } from './migrate';

const STORE_KEY = 'boligmaskinen.prototype.v3';
const OLDER_KEYS = { v2: 'boligmaskinen.prototype.v2', v1: 'boligmaskinen.prototype.v1' };

interface Saved {
  blocks: Block[];
  places: Place[];
  view: ViewState;
}

/** The blocks of the weighting, the user's places and the map settings. */
@Injectable({ providedIn: 'root' })
export class Store {
  /** The data layers of the catalogue, for the predefined blocks. */
  readonly catalogue = DEFAULT_CRITERIA;
  readonly blocks = signal<Block[]>([]);
  readonly places = signal<Place[]>([]);
  readonly view = signal<ViewState>({ ...DEFAULT_VIEW });
  /** True while the next map click should drop a new place. */
  readonly placing = signal(false);

  /** Predefined blocks in use, by template id. */
  readonly templatesInUse = computed(() => new Set(this.blocks().map((b) => b.template).filter((t): t is string => !!t)));

  constructor() {
    this.restore();
    effect(() => this.persist({ blocks: this.blocks(), places: this.places(), view: this.view() }));
  }

  // ---- blocks ----
  addBlock(block: Block): void {
    this.blocks.update((list) => [...list, block]);
  }

  /** Add a predefined block. Blocks from the catalogue are only added once. */
  addTemplate(templateId: string): void {
    const template = LIBRARY.find((t) => t.id === templateId);
    if (!template) return;
    const once = DEFAULT_CRITERIA.some((c) => c.id === templateId);
    if (once && this.templatesInUse().has(templateId)) return;
    this.addBlock(blockFrom(template));
  }

  /** Keep exactly these catalogue blocks (the catalogue dialog's checkboxes); other blocks stay. */
  setCatalogue(ids: string[]): void {
    const catalogue = new Set(DEFAULT_CRITERIA.map((c) => c.id));
    this.blocks.update((list) => list.filter((b) => !b.template || !catalogue.has(b.template) || ids.includes(b.template)));
    for (const id of ids) this.addTemplate(id);
  }

  updateBlock(id: string, patch: Partial<Omit<Block, 'id'>>): void {
    this.blocks.update((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b)));
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
    this.blocks.update((list) => list.filter((b) => b.id !== id));
  }

  // ---- places ----
  /** Drop a new place; it gets a block with the travel time to it. */
  addPlace(lng: number, lat: number): Place {
    const used = new Set(this.places().map((p) => p.name));
    let n = 1;
    while (used.has(`Place ${n}`)) n++;
    const place: Place = { id: crypto.randomUUID(), name: `Place ${n}`, lng, lat };
    this.places.update((list) => [...list, place]);
    this.addBlock(blockFrom(placeTemplate(place)));
    return place;
  }

  /** Move or rename a place. A new name renames its values in every block's code. */
  updatePlace(id: string, patch: Partial<Omit<Place, 'id'>>): void {
    const before = this.places().find((p) => p.id === id);
    if (!before) return;
    const after = { ...before, ...patch };
    this.places.update((list) => list.map((p) => (p.id === id ? after : p)));
    if (patch.name && patch.name !== before.name) {
      const renames = Object.fromEntries(MODES.map((m) => [placeValueName(before, m.mode), placeValueName(after, m.mode)]));
      this.blocks.update((list) => list.map((b) => ({
        ...b,
        code: renameValues(b.code, renames).replace(`Travel time to ${before.name},`, `Travel time to ${after.name},`),
        name: b.template === `place:${id}` && b.name === before.name ? after.name : b.name,
      })));
    }
  }

  /** Remove a place and the block made for it. */
  removePlace(id: string): void {
    this.places.update((list) => list.filter((p) => p.id !== id));
    this.blocks.update((list) => list.filter((b) => b.template !== `place:${id}`));
  }

  // ---- view ----
  setView(patch: Partial<ViewState>): void {
    this.view.update((v) => ({ ...v, ...patch }));
  }

  // ---- persistence ----
  private restore(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Saved | null;
      if (saved?.blocks) return this.apply(saved);
      // Carry over what the earlier prototypes saved
      const v2 = JSON.parse(localStorage.getItem(OLDER_KEYS.v2) ?? 'null') as SavedV2 | null;
      if (v2?.flow?.groups) return this.apply(migrateV2(v2, DEFAULT_CRITERIA));
      const v1 = JSON.parse(localStorage.getItem(OLDER_KEYS.v1) ?? 'null') as SavedV1 | null;
      if (v1) this.apply(migrateV1(v1, DEFAULT_CRITERIA));
    } catch {
      // Storage can be unavailable; the defaults are fine.
    }
  }

  private apply(saved: Migrated | Saved): void {
    // Code saved for an older version of the block language is brought up to the current one
    this.blocks.set(saved.blocks.map((b) => upgradeBlock(b).block));
    this.places.set(saved.places ?? []);
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
