import { AfterViewInit, Component, ElementRef, OnDestroy, effect, inject, signal, viewChild } from '@angular/core';
import {
  addProtocol, CanvasSource, LayerSpecification, LngLat, LngLatLike, Map as MapLibreMap, Marker, NavigationControl, Popup,
  setWorkerUrl, SourceSpecification,
} from 'maplibre-gl';
import { PMTiles, Protocol } from 'pmtiles';
import { ChunkedPmtilesSource } from '../data/byte-container';
import { DATA_BASE, PilotData } from '../data/pilot-data';
import { Store } from '../state/store';
import { PLACE_COLOURS } from '../scoring/types';
import { Breakdown, HeatService } from './heat.service';

let protocolsRegistered = false;

/** The detailed basemap covers Denmark; below this zoom the whole world comes from Natural Earth. */
const DETAIL_ZOOM = 5;
const EARTH = '#e2dfda';
const WATER = '#80deea';

/**
 * Natural Earth land, lakes, borders and names, so the map can be panned and zoomed anywhere.
 * They sit under the detailed basemap, which draws over them where it has data.
 */
function worldSources(): Record<string, SourceSpecification> {
  const source = (name: string): SourceSpecification => ({ type: 'geojson', data: `${DATA_BASE}world/${name}.json`, attribution: 'World: Natural Earth' });
  return { 'world-land': source('land'), 'world-lakes': source('lakes'), 'world-boundaries': source('boundaries'), 'world-countries': source('countries'), 'world-places': source('places') };
}

function withWorld(basemap: LayerSpecification[]): LayerSpecification[] {
  const [background, ...rest] = basemap;
  return [
    { ...background, paint: { 'background-color': WATER } } as LayerSpecification,
    { id: 'world-land', type: 'fill', source: 'world-land', paint: { 'fill-color': EARTH } },
    { id: 'world-lakes', type: 'fill', source: 'world-lakes', paint: { 'fill-color': WATER } },
    { id: 'world-boundaries', type: 'line', source: 'world-boundaries', paint: { 'line-color': '#adadad', 'line-width': 0.7, 'line-dasharray': [2, 1] } },
    ...rest,
    {
      id: 'world-places', type: 'symbol', source: 'world-places', minzoom: 2, maxzoom: DETAIL_ZOOM,
      layout: { 'text-field': ['get', 'name'], 'text-font': ['noto-regular'], 'text-size': 11, 'symbol-sort-key': ['get', 'rank'] },
      paint: { 'text-color': '#5c5c5c', 'text-halo-color': EARTH, 'text-halo-width': 1 },
    },
    {
      id: 'world-countries', type: 'symbol', source: 'world-countries', maxzoom: DETAIL_ZOOM,
      layout: {
        'text-field': ['get', 'name'], 'text-font': ['noto-medium'], 'symbol-sort-key': ['get', 'rank'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, 9, 4, 13], 'text-transform': 'uppercase', 'text-letter-spacing': 0.1,
      },
      paint: { 'text-color': '#8a8a8a', 'text-halo-color': EARTH, 'text-halo-width': 1 },
    },
  ];
}

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

/**
 * MapLibre's worker as a blob: URL. Hosts such as the artifact preview refuse workers loaded
 * from files but accept blob: workers, which is what MapLibre's bundled builds use.
 */
async function workerUrl(): Promise<string> {
  const url = new URL('maplibre-gl-worker.mjs', document.baseURI).href;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return URL.createObjectURL(new Blob([await response.text()], { type: 'text/javascript' }));
  } catch {
    return url;
  }
}

/** The full-screen MapLibre map with the heatmap overlay and the user's places. */
@Component({
  selector: 'app-map-view',
  template: `
    <div #host class="map" [class.placing]="store.placing()"></div>
    @if (problem()) {
      <div class="problem" role="alert">The map could not load: {{ problem() }}</div>
    }
  `,
  styleUrl: './map-view.scss',
})
export class MapView implements AfterViewInit, OnDestroy {
  protected readonly store = inject(Store);
  private readonly data = inject(PilotData);
  private readonly heat = inject(HeatService);
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  private map: MapLibreMap | null = null;
  /** Shown when the map fails before it has loaded, e.g. when the host blocks its worker. */
  protected readonly problem = signal<string | null>(null);
  private popup: Popup | null = null;
  private readonly markers = new Map<string, Marker>();
  private overlayReady = false;

  constructor() {
    effect(() => {
      this.heat.frame();
      this.refreshOverlay();
    });
    effect(() => {
      const view = this.store.view();
      if (!this.overlayReady || !this.map) return;
      this.map.setPaintProperty('heat', 'raster-opacity', view.opacity);
      this.map.setPaintProperty('heat', 'raster-resampling', view.smooth > 0 ? 'linear' : 'nearest');
    });
    effect(() => this.syncMarkers(this.store.places()));
    effect(() => {
      // Start the map once the grid (and its bounds) is known
      if (this.data.grid() && !this.map) void this.createMap();
    });
  }

  ngAfterViewInit(): void {
    if (this.data.grid() && !this.map) void this.createMap();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  /** Call after the container changed size, e.g. when the side panel opens or closes. */
  resize(): void {
    this.map?.resize();
  }

  private async createMap(): Promise<void> {
    const grid = this.data.grid();
    if (!grid || this.map) return;
    const [layers, glyphs, worker] = await Promise.all([
      fetch(`${DATA_BASE}style-layers.json`).then((r) => r.json()),
      fetch(`${DATA_BASE}fonts.json`).then((r) => r.json() as Promise<Record<string, string>>),
      protocolsRegistered ? null : workerUrl(),
    ]);
    if (this.map) return;

    if (!protocolsRegistered) {
      // The worker ships next to the app bundle (see the assets in angular.json)
      if (worker) setWorkerUrl(worker);
      const protocol = new Protocol();
      const parts = Array.from({ length: grid.meta.basemap.parts }, (_, i) => `${DATA_BASE}basemap/part-${i}.png`);
      protocol.add(new PMTiles(new ChunkedPmtilesSource('basemap', parts, grid.meta.basemap.chunkSize)));
      addProtocol('pmtiles', protocol.tile);
      addProtocol('glyphs', async (params) => {
        const key = decodeURIComponent(params.url.replace('glyphs://', '')).replace(/\.pbf$/, '');
        const encoded = glyphs[key];
        if (!encoded) return { data: new ArrayBuffer(0) };
        return { data: Uint8Array.from(atob(encoded), (ch) => ch.charCodeAt(0)).buffer };
      });
      protocolsRegistered = true;
    }

    const b = grid.meta.bounds;
    const map = new MapLibreMap({
      container: this.host().nativeElement,
      style: {
        version: 8,
        glyphs: 'glyphs://{fontstack}/{range}',
        sprite: `${DATA_BASE}sprites/light`,
        sources: {
          protomaps: {
            type: 'vector',
            url: 'pmtiles://basemap',
            minzoom: DETAIL_ZOOM,
            attribution: 'Basemap: <a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
          },
          ...worldSources(),
        },
        layers: withWorld(layers),
      },
      // Start on the data's region; the rest of the world is free to explore
      bounds: [[b.west, b.south], [b.east, b.north]],
      fitBoundsOptions: { padding: 24 },
      maxZoom: 18,
      // Keep the view in the address (#map=zoom/lat/lng), so a link opens the same place
      hash: 'map',
      attributionControl: {
        compact: true,
        customAttribution: 'Heatmap: © OpenStreetMap contributors · Miljøstyrelsen · Plandata.dk · Energistyrelsen · STIL · Danmarks Statistik',
      },
    });
    this.map = map;
    // Until the map has loaded, report what goes wrong instead of showing an empty map
    const report = (reason: unknown) => this.problem.set(reason instanceof Error ? reason.message : String(reason));
    const onError = (event: ErrorEvent) => report(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => report(event.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    map.on('error', (event) => { if (!this.overlayReady) report(event.error); });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      this.problem.set(null);
      map.addSource('heat', {
        type: 'canvas',
        canvas: this.heat.canvas,
        animate: false,
        coordinates: [[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south]],
      });
      const view = this.store.view();
      map.addLayer({
        id: 'heat', type: 'raster', source: 'heat',
        paint: { 'raster-opacity': view.opacity, 'raster-resampling': view.smooth > 0 ? 'linear' : 'nearest', 'raster-fade-duration': 0 },
      }, 'roads_tunnels_other_casing');
      map.addSource('municipalities', { type: 'geojson', data: `${DATA_BASE}data/municipalities.json` });
      map.addLayer({
        id: 'municipalities', type: 'line', source: 'municipalities',
        paint: { 'line-color': '#3b4046', 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.8, 12, 2], 'line-opacity': 0.55, 'line-dasharray': [3, 2] },
      }, 'address_label');
      this.overlayReady = true;
      this.refreshOverlay();
    });
    map.on('click', (event) => {
      if (this.store.placing()) {
        this.store.addPlace(event.lngLat.lng, event.lngLat.lat);
        this.store.placing.set(false);
        return;
      }
      this.showBreakdown(event.lngLat);
    });
    this.syncMarkers(this.store.places());
  }

  private refreshOverlay(): void {
    if (!this.overlayReady || !this.map) return;
    const source = this.map.getSource('heat') as CanvasSource | undefined;
    if (!source) return;
    source.play();
    source.pause();
    this.map.triggerRepaint();
  }

  private showBreakdown(lngLat: LngLat): void {
    const breakdown = this.heat.explain(this.heat.cellAt(lngLat.lng, lngLat.lat));
    if (!breakdown || !this.map) return;
    this.popup?.remove();
    this.popup = new Popup({ maxWidth: '340px' }).setLngLat(lngLat).setHTML(this.popupHtml(breakdown)).addTo(this.map);
  }

  private popupHtml(b: Breakdown): string {
    const rows = b.rows.length
      ? b.rows.map((r) => `<tr><td>${escapeHtml(r.name)}</td><td class="v">${escapeHtml(r.value)}</td><td class="p${r.failed ? ' fail' : ''}">${escapeHtml(r.result)}</td></tr>`).join('')
      : '<tr><td colspan="3">Pick what matters to you in the panel to score this spot.</td></tr>';
    return `<div class="pop"><h3>${escapeHtml(b.title)}</h3><div class="sub">${escapeHtml(b.subtitle)}</div><table>${rows}</table></div>`;
  }

  private syncMarkers(places: ReturnType<Store['places']>): void {
    const map = this.map;
    if (!map) return;
    const live = new Set(places.map((p) => p.id));
    for (const [id, marker] of this.markers) {
      if (!live.has(id)) { marker.remove(); this.markers.delete(id); }
    }
    places.forEach((place, index) => {
      let marker = this.markers.get(place.id);
      const colour = PLACE_COLOURS[index % PLACE_COLOURS.length];
      if (!marker) {
        const element = document.createElement('div');
        element.className = 'place-pin';
        marker = new Marker({ element, draggable: true, anchor: 'bottom' }).setLngLat([place.lng, place.lat]).addTo(map);
        marker.on('dragend', () => {
          const at = marker!.getLngLat();
          this.store.updatePlace(place.id, { lng: at.lng, lat: at.lat });
        });
        this.markers.set(place.id, marker);
      }
      const element = marker.getElement();
      element.style.setProperty('--pin', colour);
      element.title = place.name;
      element.textContent = String(index + 1);
      const at = marker.getLngLat();
      if (Math.abs(at.lng - place.lng) > 1e-9 || Math.abs(at.lat - place.lat) > 1e-9) marker.setLngLat([place.lng, place.lat] as LngLatLike);
    });
  }
}
