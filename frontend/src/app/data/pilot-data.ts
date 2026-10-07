import { Injectable, signal } from '@angular/core';
import { Grid, GridMeta, LayerName, Municipality } from '@boligmaskinen/engine';
import { loadByteContainer } from './byte-container';

/** Base URL of the data pack that the pilot pipeline produces (public/data-pack). */
export const DATA_BASE = new URL('data-pack/', document.baseURI).href;

export type LoadState = 'loading' | 'ready' | 'error';

/** Loads the feature grid of the data pack: all of Denmark, or a pilot region. */
@Injectable({ providedIn: 'root' })
export class PilotData {
  readonly state = signal<LoadState>('loading');
  readonly message = signal('Loading data…');
  readonly grid = signal<Grid | null>(null);

  async load(): Promise<void> {
    try {
      const meta: GridMeta = await fetch(`${DATA_BASE}data/meta.json`).then((r) => r.json());
      const names = Object.keys(meta.files) as LayerName[];
      let loaded = 0;
      this.message.set(`Loading ${names.length} data layers…`);
      const entries = await Promise.all(
        names.map(async (name) => {
          const bytes = await loadByteContainer(`${DATA_BASE}data/${meta.files[name]}`);
          if (bytes.length !== meta.width * meta.height) throw new Error(`${name}: unexpected size ${bytes.length}`);
          this.message.set(`Loading data layers… ${++loaded} of ${names.length}`);
          return [name, bytes] as const;
        }),
      );
      const layers = Object.fromEntries(entries) as Record<LayerName, Uint8Array>;
      const municipalities: (Municipality | undefined)[] = [];
      for (const m of meta.municipalities) municipalities[m.index] = m;

      const homes: number[] = [];
      const land: number[] = [];
      const mask = layers.mask;
      for (let cell = 0; cell < mask.length; cell++) {
        if (mask[cell] & 1) {
          land.push(cell);
          if (mask[cell] & 2) homes.push(cell);
        }
      }
      this.grid.set({
        meta, width: meta.width, height: meta.height, layers, municipalities,
        homeCells: Uint32Array.from(homes), landCells: Uint32Array.from(land),
      });
      this.state.set('ready');
    } catch (error) {
      console.error(error);
      this.message.set(`Could not load the data: ${(error as Error).message}`);
      this.state.set('error');
    }
  }
}
