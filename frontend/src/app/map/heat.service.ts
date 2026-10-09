import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { Grid, mercatorFrame, MercatorFrame, ValueInfo } from '@boligmaskinen/engine';
import { PilotData } from '../data/pilot-data';
import { Store } from '../state/store';
import { ThemeService } from '../theme/theme.service';
import { Breakdown, HeatEngine, HeatMessage, HeatRequest, HeatResult, HeatStats } from './heat-engine';

export type { Breakdown, HeatStats } from './heat-engine';

type WorkerReply =
  | { type: 'rendered'; id: number; result: HeatResult; buffer: ArrayBuffer }
  | { type: 'explained'; id: number; breakdown: Breakdown | null };

/**
 * Turns the blocks into a heatmap canvas, statistics, block previews and explanations. The work
 * (HeatEngine) runs in a Web Worker, so the page answers while a slider moves; where there are no
 * workers, as in the unit tests, it runs here.
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
  private grid: Grid | null = null;
  /** The pixels, which go to the worker and back. */
  private buffer: ArrayBuffer | null = null;
  private busy = false;
  /** Something changed while the worker drew: it draws again with the newest state, once. */
  private dirty = false;
  private nextId = 1;
  private readonly explaining = new Map<number, (breakdown: Breakdown | null) => void>();

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
      this.busy = false;
    };
    // The layers move to the worker without a copy; the page only needs the grid's description
    const layers = Object.values(grid.layers).map((layer) => layer.buffer as ArrayBuffer);
    this.post({ type: 'grid', grid }, [...layers, grid.homeCells.buffer as ArrayBuffer, grid.landCells.buffer as ArrayBuffer]);
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

  private render(): void {
    this.dirty = false;
    const request = this.request();
    if (this.engine) {
      const pixels = new Uint32Array(this.buffer!);
      this.show(this.engine.render(request, pixels), this.buffer!);
      return;
    }
    const buffer = this.buffer!;
    this.buffer = null;
    this.post({ type: 'render', id: this.nextId++, request, buffer }, [buffer]);
  }

  private receive(reply: WorkerReply): void {
    if (reply.type === 'explained') {
      this.explaining.get(reply.id)?.(reply.breakdown);
      this.explaining.delete(reply.id);
      return;
    }
    this.buffer = reply.buffer;
    this.show(reply.result, reply.buffer);
  }

  private show(result: HeatResult, buffer: ArrayBuffer): void {
    const grid = this.grid!;
    this.canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(buffer), grid.width, grid.height), 0, 0);
    this.issues.set(new Map(result.issues));
    this.preview.set(new Map(result.previews));
    this.stats.set(result.stats);
    this.frame.update((f) => f + 1);
    this.busy = false;
    if (this.dirty) this.schedule(grid);
  }

  /** Points breakdown for one raster cell, or null outside the region. */
  explain(cell: number): Promise<Breakdown | null> {
    const request = { blocks: this.store.activeBlocks(), places: this.store.places() };
    if (!this.worker) return Promise.resolve(this.engine?.explain(cell, request) ?? null);
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.explaining.set(id, resolve);
      this.post({ type: 'explain', id, cell, request });
    });
  }

  /** Raster cell index under a longitude/latitude, or -1. */
  cellAt(lng: number, lat: number): number {
    const grid = this.data.grid();
    const frame = this.mercator();
    if (!grid || !frame) return -1;
    const R = 6378137;
    const x = (R * lng * Math.PI) / 180;
    const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
    const col = Math.floor((x - frame.x0) / frame.pixel);
    const row = Math.floor((frame.y1 - y) / frame.pixel);
    return col >= 0 && col < grid.width && row >= 0 && row < grid.height ? row * grid.width + col : -1;
  }
}
