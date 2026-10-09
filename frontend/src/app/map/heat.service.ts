import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { Grid, mercatorFrame, MercatorFrame, ValueInfo } from '@boligmaskinen/engine';
import { loadByteContainer } from '../data/byte-container';
import { PilotData } from '../data/pilot-data';
import { Store } from '../state/store';
import { ThemeService } from '../theme/theme.service';
import { Bounds, corners, DETAIL_ZOOM, mosaic, sameRange, tileKeys, TileRange, tilesFor } from './detail';
import { Breakdown, HeatEngine, HeatMessage, HeatRequest, HeatResult, HeatStats } from './heat-engine';

export type { Breakdown, HeatStats } from './heat-engine';

type WorkerReply =
  | { type: 'rendered'; id: number; result: HeatResult; buffer: ArrayBuffer; detail: ArrayBuffer | null }
  | { type: 'explained'; id: number; breakdown: Breakdown | null };

/** How many detail tiles the page keeps, so panning back does not fetch them again. */
const TILE_CACHE = 60;

/**
 * Turns the blocks into a heatmap canvas, statistics, block previews and explanations. The work
 * (HeatEngine) runs in a Web Worker, so the page answers while a slider moves; where there are no
 * workers, as in the unit tests, it runs here. Zoomed in, a second canvas shows the grid's own
 * cells around the view, from the data pack's detail tiles (detail.ts).
 */
@Injectable({ providedIn: 'root' })
export class HeatService {
  private readonly data = inject(PilotData);
  private readonly store = inject(Store);
  private readonly theme = inject(ThemeService);

  readonly canvas = document.createElement('canvas');
  /** Increments every time the canvas has new pixels. */
  readonly frame = signal(0);
  readonly stats = signal<HeatStats | null>(null);
  /** Each block's result in words, e.g. "Median score 0.62" or "84 % of the cells pass". */
  readonly preview = signal<Map<string, string>>(new Map());
  /** Blocks that cannot run, with the reason. */
  readonly issues = signal<Map<string, string>>(new Map());

  /** The grid's own cells around the view, when the map is zoomed in far enough and they are drawn. */
  readonly detailCanvas = document.createElement('canvas');
  readonly detail = signal<{ corners: ReturnType<typeof corners> } | null>(null);
  /** Increments every time the detail canvas has new pixels. */
  readonly detailFrame = signal(0);

  /** Every value a block can read: the data, and the travel times to the user's places. */
  readonly values = computed<ValueInfo[]>(() => HeatEngine.values(this.store.places()));
  readonly names = computed(() => this.values().map((v) => v.name));

  private readonly mercator = computed<MercatorFrame | null>(() => {
    const grid = this.data.grid();
    return grid ? mercatorFrame(grid) : null;
  });

  private worker: Worker | null = null;
  /** In the page, where there are no workers. */
  private engine: HeatEngine | null = null;
  private detailEngine: HeatEngine | null = null;
  private grid: Grid | null = null;
  /** The pixels, which go to the worker and back. */
  private buffer: ArrayBuffer | null = null;
  private busy = false;
  /** Something changed while the worker drew: it draws again with the newest state, once. */
  private dirty = false;
  private nextId = 1;
  private readonly explaining = new Map<number, (breakdown: Breakdown | null) => void>();

  /** The tiles the view wants, those the worker has, and the detail grid's description. */
  private wanted: TileRange | null = null;
  private loaded: TileRange | null = null;
  private detailGrid: { width: number; height: number; corners: ReturnType<typeof corners>; frame: MercatorFrame } | null = null;
  private detailBuffer: ArrayBuffer | null = null;
  private readonly tiles = new Map<string, Uint8Array>();

  constructor() {
    effect(() => {
      const grid = this.data.grid();
      this.store.activeBlocks();
      this.store.places();
      this.store.view();
      this.theme.scheme();
      if (grid) this.schedule(grid);
    });
    inject(DestroyRef).onDestroy(() => this.worker?.terminate());
  }

  private start(grid: Grid): void {
    this.grid = grid;
    this.canvas.width = grid.width;
    this.canvas.height = grid.height;
    this.buffer = new ArrayBuffer(grid.width * grid.height * 4);
    if (typeof Worker === 'undefined') {
      this.engine = new HeatEngine(grid);
      return;
    }
    this.worker = new Worker(new URL('./heat.worker', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({ data }: MessageEvent<WorkerReply>) => this.receive(data);
    this.worker.onerror = (event) => {
      // The map keeps what it shows; the next change draws again
      console.error('The heat worker failed', event.message);
      this.buffer ??= new ArrayBuffer(grid.width * grid.height * 4);
      if (this.detailGrid) this.detailBuffer ??= new ArrayBuffer(this.detailGrid.width * this.detailGrid.height * 4);
      this.busy = false;
    };
    // The layers move to the worker without a copy; the page only needs the grid's description
    this.post({ type: 'grid', grid }, transfers(grid));
  }

  private post(message: HeatMessage, transfer: Transferable[] = []): void {
    this.worker!.postMessage(message, transfer);
  }

  private request(): HeatRequest {
    return { blocks: this.store.activeBlocks(), places: this.store.places(), view: this.store.view(), scheme: this.theme.scheme() };
  }

  private schedule(grid: Grid): void {
    if (this.grid !== grid) this.start(grid);
    if (this.busy) {
      this.dirty = true;
      return;
    }
    this.busy = true;
    // Wait for the frame, so a burst of changes is drawn once
    requestAnimationFrame(() => this.render());
  }

  /** Whether the detail is wanted and its grid is the one the view wants. */
  private get detailWanted(): boolean {
    return !!this.wanted && sameRange(this.wanted, this.loaded);
  }

  private render(): void {
    this.dirty = false;
    const request = this.request();
    const detail = this.detailWanted;
    if (this.engine) {
      const result = this.engine.render(request, new Uint32Array(this.buffer!));
      if (detail && this.detailEngine) this.detailEngine.render(request, new Uint32Array(this.detailBuffer!), result.stats);
      this.show(result, this.buffer!, detail ? this.detailBuffer : null);
      return;
    }
    const buffer = this.buffer!;
    const detailBuffer = detail ? this.detailBuffer : null;
    this.buffer = null;
    if (detailBuffer) this.detailBuffer = null;
    this.post({ type: 'render', id: this.nextId++, request, buffer, detail: detailBuffer }, [buffer, ...(detailBuffer ? [detailBuffer] : [])]);
  }

  private receive(reply: WorkerReply): void {
    if (reply.type === 'explained') {
      this.explaining.get(reply.id)?.(reply.breakdown);
      this.explaining.delete(reply.id);
      return;
    }
    this.buffer = reply.buffer;
    if (reply.detail) this.detailBuffer = reply.detail;
    this.show(reply.result, reply.buffer, reply.detail);
  }

  private show(result: HeatResult, buffer: ArrayBuffer, detail: ArrayBuffer | null): void {
    const grid = this.grid!;
    this.canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(buffer), grid.width, grid.height), 0, 0);
    // Detail drawn for a view the map has left since is not shown
    if (detail && this.detailGrid && this.detailWanted) {
      const { width, height } = this.detailGrid;
      this.detailCanvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(detail), width, height), 0, 0);
      if (this.detail()?.corners !== this.detailGrid.corners) this.detail.set({ corners: this.detailGrid.corners });
      this.detailFrame.update((f) => f + 1);
    }
    this.issues.set(new Map(result.issues));
    this.preview.set(new Map(result.previews));
    this.stats.set(result.stats);
    this.frame.update((f) => f + 1);
    this.busy = false;
    if (this.dirty) this.schedule(grid);
  }

  /**
   * Where the map looks: zoomed in far enough, the grid's own cells are drawn around the view, from
   * the detail tiles of the data pack; zoomed out, the region's grid is enough.
   */
  setView(view: Bounds, zoom: number): void {
    const grid = this.data.grid();
    const tiles = grid?.meta.tiles;
    const range = tiles && zoom >= DETAIL_ZOOM ? tilesFor(tiles, view) : null;
    if (sameRange(range, this.wanted)) return;
    this.wanted = range;
    if (!range || !grid) {
      this.detail.set(null);
      return;
    }
    if (sameRange(range, this.loaded)) {
      this.schedule(grid);
      return;
    }
    void this.loadDetail(grid, range);
  }

  private async loadDetail(grid: Grid, range: TileRange): Promise<void> {
    const available = new Set(grid.meta.tiles!.available);
    const missing = tileKeys(range).filter((key) => available.has(key) && !this.tiles.has(key));
    try {
      const fetched = await Promise.all(missing.map(async (key) => [key, await loadByteContainer(`${this.data.base}tiles/${key}.png`)] as const));
      for (const [key, data] of fetched) this.tiles.set(key, data);
    } catch (error) {
      // Without its tiles the map keeps the region's grid
      console.error('Could not load the detail tiles', error);
      return;
    }
    while (this.tiles.size > TILE_CACHE) this.tiles.delete(this.tiles.keys().next().value!);
    // The view has moved on while the tiles came
    if (!sameRange(range, this.wanted)) return;
    const detail = mosaic(grid, range, (key) => this.tiles.get(key));
    this.loaded = range;
    this.detailGrid = { width: detail.width, height: detail.height, corners: corners(detail), frame: mercatorFrame(detail) };
    this.detailCanvas.width = detail.width;
    this.detailCanvas.height = detail.height;
    this.detailBuffer = new ArrayBuffer(detail.width * detail.height * 4);
    if (this.worker) this.post({ type: 'detail', grid: detail }, transfers(detail));
    else this.detailEngine = new HeatEngine(detail);
    this.schedule(grid);
  }

  /** Points breakdown for the spot under a longitude/latitude, from the grid the map shows there. */
  explainAt(lng: number, lat: number): Promise<Breakdown | null> {
    const request = { blocks: this.store.activeBlocks(), places: this.store.places() };
    const inDetail = this.detail() && this.detailGrid ? cellOf(this.detailGrid, this.detailGrid.frame, lng, lat) : -1;
    const detail = inDetail >= 0;
    const cell = detail ? inDetail : this.cellAt(lng, lat);
    if (!this.worker) return Promise.resolve((detail ? this.detailEngine : this.engine)?.explain(cell, request) ?? null);
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.explaining.set(id, resolve);
      this.post({ type: 'explain', id, cell, detail, request });
    });
  }

  /** Raster cell index of the region's grid under a longitude/latitude, or -1. */
  cellAt(lng: number, lat: number): number {
    const grid = this.data.grid();
    const frame = this.mercator();
    return grid && frame ? cellOf(grid, frame, lng, lat) : -1;
  }
}

/** The buffers of a grid's layers and cell lists, which move to the worker. */
function transfers(grid: Grid): Transferable[] {
  return [...Object.values(grid.layers).map((layer) => layer.buffer as ArrayBuffer), grid.homeCells.buffer as ArrayBuffer, grid.landCells.buffer as ArrayBuffer];
}

function cellOf(grid: Pick<Grid, 'width' | 'height'>, frame: MercatorFrame, lng: number, lat: number): number {
  const R = 6378137;
  const x = (R * lng * Math.PI) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const col = Math.floor((x - frame.x0) / frame.pixel);
  const row = Math.floor((frame.y1 - y) / frame.pixel);
  return col >= 0 && col < grid.width && row >= 0 && row < grid.height ? row * grid.width + col : -1;
}
