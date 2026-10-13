import { AfterViewInit, Component, ElementRef, OnDestroy, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import {
  addProtocol, CanvasSource, LayerSpecification, LngLat, LngLatLike, Map as MapLibreMap, Marker, NavigationControl, Popup,
  setWorkerUrl, SourceSpecification,
} from 'maplibre-gl';
import { formatNumber, formatValueOf } from '@boligmaskinen/engine';
import { TranslocoPipe } from '@jsverse/transloco';
import { PMTiles, Protocol } from 'pmtiles';
import { ChunkedPmtilesSource } from '../data/byte-container';
import { PilotData } from '../data/pilot-data';
import { I18n } from '../i18n/i18n';
import { Texts } from '../i18n/texts';
import { Store } from '../state/store';
import { PLACE_COLOURS } from '@boligmaskinen/engine';
import { Scheme, ThemeService } from '../theme/theme.service';
import { BASEMAP_FILES, MAP_COLOURS, MapColours } from './colours';
import { Breakdown, BreakdownRow, HeatService } from './heat.service';

let protocolsRegistered = false;

/** The detailed basemap covers Denmark; below this zoom the whole world comes from Natural Earth. */
const DETAIL_ZOOM = 5;

/**
 * Natural Earth land, lakes, borders and names, so the map can be panned and zoomed anywhere.
 * They sit under the detailed basemap, which draws over them where it has data.
 */
function worldSources(base: string): Record<string, SourceSpecification> {
  const source = (name: string): SourceSpecification => ({ type: 'geojson', data: `${base}world/${name}.json` });
  return { 'world-land': source('land'), 'world-lakes': source('lakes'), 'world-boundaries': source('boundaries'), 'world-countries': source('countries'), 'world-places': source('places') };
}

function withWorld(basemap: LayerSpecification[], colours: MapColours): LayerSpecification[] {
  const [background, ...rest] = basemap;
  return [
    { ...background, paint: { 'background-color': colours.water } } as LayerSpecification,
    { id: 'world-land', type: 'fill', source: 'world-land', paint: { 'fill-color': colours.earth } },
    { id: 'world-lakes', type: 'fill', source: 'world-lakes', paint: { 'fill-color': colours.water } },
    { id: 'world-boundaries', type: 'line', source: 'world-boundaries', paint: { 'line-color': colours.boundaries, 'line-width': 0.7, 'line-dasharray': [2, 1] } },
    ...rest,
    {
      id: 'world-places', type: 'symbol', source: 'world-places', minzoom: 2, maxzoom: DETAIL_ZOOM,
      layout: { 'text-field': ['get', 'name'], 'text-font': ['noto-regular'], 'text-size': 11, 'symbol-sort-key': ['get', 'rank'] },
      paint: { 'text-color': colours.placeLabel, 'text-halo-color': colours.earth, 'text-halo-width': 1 },
    },
    {
      id: 'world-countries', type: 'symbol', source: 'world-countries', maxzoom: DETAIL_ZOOM,
      layout: {
        'text-field': ['get', 'name'], 'text-font': ['noto-medium'], 'symbol-sort-key': ['get', 'rank'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, 9, 4, 13], 'text-transform': 'uppercase', 'text-letter-spacing': 0.1,
      },
      paint: { 'text-color': colours.countryLabel, 'text-halo-color': colours.earth, 'text-halo-width': 1 },
    },
  ];
}

type PaintProperty = Parameters<MapLibreMap['setPaintProperty']>[1];

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

/** How long OpenStreetMap's credit stays on the map once it has loaded. */
const CREDIT_MS = 5000;

/** The terrain's shading in a scheme's colours: Denmark is flat, so its slopes are drawn steeper. */
function shading(colours: MapColours) {
  return { 'hillshade-shadow-color': colours.shadow, 'hillshade-highlight-color': colours.highlight, 'hillshade-accent-color': colours.shadow, 'hillshade-exaggeration': 0.85 };
}

/** The full-screen MapLibre map with the heatmap overlay and the user's places. */
@Component({
  selector: 'app-map-view',
  imports: [TranslocoPipe],
  template: `
    <div #host class="map" [class.placing]="store.placing()" [class.dark]="theme.scheme() === 'dark'" [style.background]="colours().water"></div>
    @if (problem()) {
      <div class="problem" role="alert">{{ 'map.problem' | transloco: { problem: problem() } }}</div>
    }
    <a class="credit" [class.gone]="!credit()" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener"
       [attr.aria-hidden]="credit() ? null : 'true'" [attr.tabindex]="credit() ? null : -1">© OpenStreetMap</a>
  `,
  styleUrl: './map-view.scss',
})
export class MapView implements AfterViewInit, OnDestroy {
  protected readonly store = inject(Store);
  protected readonly theme = inject(ThemeService);
  private readonly data = inject(PilotData);
  private readonly heat = inject(HeatService);
  private readonly i18n = inject(I18n);
  private readonly texts = inject(Texts);
  protected readonly colours = computed(() => MAP_COLOURS[this.theme.scheme()]);
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  /**
   * How much of the map the panels cover, in pixels: the left side on a larger screen, the top and
   * the bottom on a phone. The map centres what it shows in the rest, and moves with the panels.
   */
  readonly inset = input<{ top: number; left: number; bottom: number }>({ top: 0, left: 0, bottom: 0 });

  private map: MapLibreMap | null = null;
  /** Shown when the map fails before it has loaded, e.g. when the host blocks its worker. */
  protected readonly problem = signal<string | null>(null);
  /**
   * OpenStreetMap's credit, on the map until it is first moved or for five seconds, as OSMF's
   * attribution guidelines ask; after that, "About the data" credits it with every other source.
   */
  protected readonly credit = signal(true);
  private popup: Popup | null = null;
  private readonly markers = new Map<string, Marker>();
  private overlayReady = false;
  /** The basemap's style layers per scheme, fetched when first needed. */
  private readonly basemapLayers = new Map<Scheme, Promise<LayerSpecification[]>>();
  /** The scheme the map is coloured for. */
  private styledScheme: Scheme | null = null;

  constructor() {
    effect(() => {
      this.heat.frame();
      this.refreshOverlay('heat');
    });
    effect(() => {
      this.heat.detailFrame();
      this.refreshOverlay('heat-detail');
    });
    effect(() => {
      // Zoomed in, the grid's own cells cover the view, and the region's coarser grid steps aside
      const detail = this.heat.detail();
      if (!this.overlayReady || !this.map) return;
      if (detail) (this.map.getSource('heat-detail') as CanvasSource).setCoordinates(detail.corners);
      this.map.setLayoutProperty('heat-detail', 'visibility', detail ? 'visible' : 'none');
      this.map.setLayoutProperty('heat', 'visibility', detail ? 'none' : 'visible');
    });
    effect(() => {
      const view = this.store.view();
      if (!this.overlayReady || !this.map) return;
      for (const layer of ['heat', 'heat-detail']) {
        this.map.setPaintProperty(layer, 'raster-opacity', view.opacity);
        this.map.setPaintProperty(layer, 'raster-resampling', view.smooth > 0 ? 'linear' : 'nearest');
      }
      if (this.map.getLayer('terrain')) this.map.setLayoutProperty('terrain', 'visibility', view.background === 'terrain' ? 'visible' : 'none');
    });
    effect(() => this.syncMarkers(this.store.places()));
    effect(() => {
      const scheme = this.theme.scheme();
      if (this.overlayReady) void this.restyle(scheme);
    });
    effect(() => {
      // Start the map once the grid (and its bounds) is known
      if (this.data.grid() && !this.map) void this.createMap();
    });
    effect(() => {
      const { top, left, bottom } = this.inset();
      untracked(() => this.map?.easeTo({ padding: { top, right: 0, bottom, left }, duration: 300 }));
    });
  }

  ngAfterViewInit(): void {
    if (this.data.grid() && !this.map) void this.createMap();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private async createMap(): Promise<void> {
    const grid = this.data.grid();
    if (!grid || this.map) return;
    const scheme = this.theme.scheme();
    const [layers, glyphs, worker] = await Promise.all([
      // A data pack without the dark flavour still gets a map, in the light flavour's colours
      this.layersFor(scheme).catch(() => this.layersFor('light')),
      fetch(`${this.data.base}fonts.json`).then((r) => r.json() as Promise<Record<string, string>>),
      protocolsRegistered ? null : workerUrl(),
    ]);
    if (this.map) return;

    if (!protocolsRegistered) {
      // The worker ships next to the app bundle (see the assets in angular.json)
      if (worker) setWorkerUrl(worker);
      const protocol = new Protocol();
      const parts = Array.from({ length: grid.meta.basemap.parts }, (_, i) => `${this.data.base}basemap/part-${i}.png`);
      protocol.add(new PMTiles(new ChunkedPmtilesSource('basemap', parts, grid.meta.basemap.chunkSize)));
      const terrain = grid.meta.terrain;
      if (terrain) {
        const terrainParts = Array.from({ length: terrain.parts }, (_, i) => `${this.data.base}terrain/part-${i}.png`);
        protocol.add(new PMTiles(new ChunkedPmtilesSource('terrain', terrainParts, terrain.chunkSize)));
      }
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
        sprite: `${this.data.base}${BASEMAP_FILES[scheme].sprite}`,
        sources: {
          protomaps: {
            type: 'vector',
            url: 'pmtiles://basemap',
            minzoom: DETAIL_ZOOM,
          },
          ...worldSources(this.data.base),
          // The terrain step's tiles: the elevation model as Terrarium, which the background "Terrain" shades
          ...(grid.meta.terrain ? { terrain: { type: 'raster-dem', url: 'pmtiles://terrain', tileSize: 512, encoding: 'terrarium' } as const } : {}),
        },
        layers: withWorld(layers, MAP_COLOURS[scheme]),
      },
      // Start on the data's region; the rest of the world is free to explore
      bounds: [[b.west, b.south], [b.east, b.north]],
      fitBoundsOptions: { padding: 24 },
      maxZoom: 18,
      // Keep the view in the address (#map=zoom/lat/lng), so a link opens the same place
      hash: 'map',
      // Every source is credited in "About the data" (SOURCES), not on the map
      attributionControl: false,
    });
    this.map = map;
    this.styledScheme = scheme;
    // What the panel covers is left out of the view; a link with a view of its own keeps it
    map.setPadding({ right: 0, ...this.inset() });
    if (!/[#&]map=/.test(location.hash)) map.fitBounds([[b.west, b.south], [b.east, b.north]], { padding: 24, duration: 0 });
    // Until the map has loaded, report what goes wrong instead of showing an empty map
    const report = (reason: unknown) => this.problem.set(reason instanceof Error ? reason.message : String(reason));
    const onError = (event: ErrorEvent) => report(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => report(event.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    map.on('error', (event) => { if (!this.overlayReady) report(event.error); });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    const hideCredit = () => this.credit.set(false);
    for (const event of ['dragstart', 'zoomstart', 'click'] as const) map.once(event, hideCredit);
    map.on('load', () => {
      setTimeout(hideCredit, CREDIT_MS);
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
      const paint = { 'raster-opacity': view.opacity, 'raster-resampling': view.smooth > 0 ? 'linear' : 'nearest', 'raster-fade-duration': 0 } as const;
      map.addLayer({ id: 'heat', type: 'raster', source: 'heat', paint }, 'roads_tunnels_other_casing');
      // The grid's own cells around the view, when zoomed in (HeatService.setView)
      map.addSource('heat-detail', {
        type: 'canvas', canvas: this.heat.detailCanvas, animate: false,
        coordinates: [[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south]],
      });
      map.addLayer({ id: 'heat-detail', type: 'raster', source: 'heat-detail', layout: { visibility: 'none' }, paint }, 'roads_tunnels_other_casing');
      // The terrain shades the heatmap too, under the roads and the names
      if (grid.meta.terrain) {
        map.addLayer({
          id: 'terrain', type: 'hillshade', source: 'terrain',
          layout: { visibility: view.background === 'terrain' ? 'visible' : 'none' },
          paint: shading(MAP_COLOURS[scheme]),
        }, 'roads_tunnels_other_casing');
      }
      const look = () => {
        const bounds = map.getBounds();
        this.heat.setView({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() }, map.getZoom());
      };
      map.on('moveend', look);
      look();
      map.addSource('municipalities', { type: 'geojson', data: `${this.data.base}data/municipalities.json` });
      map.addLayer({
        id: 'municipalities', type: 'line', source: 'municipalities',
        paint: { 'line-color': MAP_COLOURS[scheme].municipalities, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.8, 12, 2], 'line-opacity': 0.55, 'line-dasharray': [3, 2] },
      }, 'address_label');
      this.overlayReady = true;
      this.refreshOverlay('heat');
      // The theme may have changed while the map was loading
      void this.restyle(this.theme.scheme());
    });
    map.on('click', (event) => {
      if (this.store.placing()) {
        this.store.addPlace(event.lngLat.lng, event.lngLat.lat);
        this.store.placing.set(false);
        return;
      }
      void this.showBreakdown(event.lngLat);
    });
    this.syncMarkers(this.store.places());
  }

  /** The basemap's style layers for a scheme, from the data pack. */
  private layersFor(scheme: Scheme): Promise<LayerSpecification[]> {
    let layers = this.basemapLayers.get(scheme);
    if (!layers) {
      layers = fetch(`${this.data.base}${BASEMAP_FILES[scheme].layers}`).then((response) => {
        if (!response.ok) throw new Error(`The basemap style is missing (HTTP ${response.status})`);
        return response.json() as Promise<LayerSpecification[]>;
      });
      layers.catch(() => this.basemapLayers.delete(scheme));
      this.basemapLayers.set(scheme, layers);
    }
    return layers;
  }

  /**
   * Recolour the map for a scheme. Both flavours of the basemap have the same layers and differ
   * only in colours and icons, so the paint is updated in place and no tiles are loaded again.
   */
  private async restyle(scheme: Scheme): Promise<void> {
    if (scheme === this.styledScheme) return;
    let layers: LayerSpecification[];
    try {
      layers = await this.layersFor(scheme);
    } catch {
      return;
    }
    const map = this.map;
    // A later change of theme takes over
    if (!map || scheme !== this.theme.scheme() || scheme === this.styledScheme) return;
    const colours = MAP_COLOURS[scheme];
    for (const layer of withWorld(layers, colours)) {
      if (!('paint' in layer) || !layer.paint || !map.getLayer(layer.id)) continue;
      for (const [property, value] of Object.entries(layer.paint)) map.setPaintProperty(layer.id, property as PaintProperty, value);
    }
    map.setPaintProperty('municipalities', 'line-color', colours.municipalities);
    if (map.getLayer('terrain')) {
      for (const [property, value] of Object.entries(shading(colours))) map.setPaintProperty('terrain', property as PaintProperty, value);
    }
    map.setSprite(`${this.data.base}${BASEMAP_FILES[scheme].sprite}`);
    this.styledScheme = scheme;
  }

  private refreshOverlay(id: 'heat' | 'heat-detail'): void {
    if (!this.overlayReady || !this.map) return;
    const source = this.map.getSource(id) as CanvasSource | undefined;
    if (!source) return;
    source.play();
    source.pause();
    this.map.triggerRepaint();
  }

  private async showBreakdown(lngLat: LngLat): Promise<void> {
    const breakdown = await this.heat.explainAt(lngLat.lng, lngLat.lat);
    if (!breakdown || !this.map) return;
    this.popup?.remove();
    this.popup = new Popup({ maxWidth: '340px' }).setLngLat(lngLat).setHTML(this.popupHtml(breakdown)).addTo(this.map);
  }

  private popupHtml(b: Breakdown): string {
    const t = this.i18n.t.bind(this.i18n);
    const where = t('popup.municipality', { name: b.municipality });
    const [title, subtitle] = b.points === null ? [t('popup.noScore'), `${t('popup.addSomething')} · ${where}`]
      : b.leftOut ? [t('popup.leftOut'), `${t('popup.notMet')} · ${where}`]
        : [t('popup.points', { points: b.points }), [t(b.homes ? 'popup.homes' : 'popup.noHomes'), where, ...(b.area === null ? [] : [t('popup.area', { points: b.area })])].join(' · ')];
    const rows = b.rows.length
      ? b.rows.map((r) => {
        const { name, value, result, failed } = this.rowWords(r);
        return `<tr><td>${escapeHtml(name)}</td><td class="v">${escapeHtml(value)}</td><td class="p${failed ? ' fail' : ''}">${escapeHtml(result)}</td></tr>`;
      }).join('')
      : `<tr><td colspan="3">${escapeHtml(t('popup.empty'))}</td></tr>`;
    return `<div class="pop"><h3>${escapeHtml(title)}</h3><div class="sub">${escapeHtml(subtitle)}</div><table>${rows}</table></div>`;
  }

  /** A block's row in the popup: its name, the value it reads, and what it gives. */
  private rowWords(row: BreakdownRow): { name: string; value: string; result: string; failed: boolean } {
    const wording = this.texts.wording();
    const block = this.store.activeBlocks().find((b) => b.id === row.id);
    const name = block ? this.texts.blockName(block) : row.id;
    const info = row.input && this.heat.values().find((v) => v.name === row.input!.name);
    const input = info ? formatValueOf(info, row.input!.value, wording) : '';
    if (row.role === 'must') {
      const met = row.score !== 0;
      return { name, value: input, result: this.i18n.t(met ? 'popup.met' : 'popup.failed'), failed: !met };
    }
    const weight = formatNumber(row.weight, wording, 0, 2);
    if (Number.isNaN(row.score)) return { name, value: input || wording.noData, result: `– / ${weight}`, failed: false };
    return { name, value: input || formatNumber(row.score, wording, 2), result: `${formatNumber(row.score * row.weight, wording, 1)} / ${weight}`, failed: false };
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
