import { inject, Injectable, signal } from '@angular/core';
import { Grid, GridMeta, LayerName, Municipality, sitesFrom, SitesFile } from '@boligmaskinen/engine';
import { I18n } from '../i18n/i18n';
import { loadByteContainer } from './byte-container';

/** The current data pack: its meta.json says which pack that is (public/data-pack in development). */
export const DATA_BASE = new URL('data-pack/', document.baseURI).href;

/**
 * Where the rest of a pack's files are: the pack's own path when its meta.json names one, so a
 * pack the server switches to meanwhile does not mix with this one, and the files may be cached.
 */
export function packBase(meta: Pick<GridMeta, 'pack'>): string {
  return meta.pack ? new URL(`data-packs/${encodeURIComponent(meta.pack)}/`, document.baseURI).href : DATA_BASE;
}

export type LoadState = 'loading' | 'ready' | 'error';

/** Loads the feature grid of the data pack: all of Denmark, or a pilot region. */
@Injectable({ providedIn: 'root' })
export class PilotData {
  private readonly i18n = inject(I18n);
  readonly state = signal<LoadState>('loading');
  readonly message = signal(this.i18n.t('data.loading'));
  readonly grid = signal<Grid | null>(null);
  /** Where the loaded pack's files are (packBase). */
  base = DATA_BASE;

  async load(): Promise<void> {
    try {
      const meta: GridMeta = await fetch(`${DATA_BASE}data/meta.json`, { cache: 'no-cache' }).then((r) => r.json());
      const base = packBase(meta);
      const names = Object.keys(meta.files) as LayerName[];
      let loaded = 0;
      this.message.set(this.i18n.t('data.loadingLayers', { n: names.length }));
      const entries = await Promise.all(
        names.map(async (name) => {
          const bytes = await loadByteContainer(`${base}data/${meta.files[name]}`);
          if (bytes.length !== meta.width * meta.height) throw new Error(`${name}: unexpected size ${bytes.length}`);
          this.message.set(this.i18n.t('data.loadedLayers', { done: ++loaded, n: names.length }));
          return [name, bytes] as const;
        }),
      );
      const layers = Object.fromEntries(entries) as Record<LayerName, Uint8Array>;
      const sites = await this.loadSites(base, meta);
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
      this.base = base;
      this.grid.set({
        meta, width: meta.width, height: meta.height, layers, municipalities,
        homeCells: Uint32Array.from(homes), landCells: Uint32Array.from(land), sites,
      });
      this.state.set('ready');
    } catch (error) {
      console.error(error);
      this.message.set(this.i18n.t('data.failed', { error: (error as Error).message }));
      this.state.set('error');
    }
  }

  /** The points the map measures distances to itself, such as the chargers; a block that reads them has no data without. */
  private async loadSites(base: string, meta: GridMeta): Promise<Grid['sites']> {
    const sites: NonNullable<Grid['sites']> = {};
    for (const [name, file] of Object.entries(meta.sites ?? {}) as [keyof NonNullable<Grid['sites']>, string][]) {
      try {
        const response = await fetch(`${base}data/${file}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        sites[name] = sitesFrom((await response.json()) as SitesFile);
      } catch (error) {
        console.error(`Could not load ${file}`, error);
      }
    }
    return sites;
  }
}
