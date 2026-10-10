/** Shared types and defaults for the scoring engine and the UI. */

export type LayerName =
  | 'forest' | 'water' | 'beach' | 'noise' | 'supermarket' | 'school' | 'daycare'
  | 'station' | 'pharmacy' | 'library' | 'turbine' | 'turbine_heights' | 'solar' | 'airport' | 'airfield' | 'air_station' | 'protected_area'
  | 'natura2000' | 'density' | 'zone' | 'municipality' | 'no2' | 'pm25' | 'mask';

/** How a raw 8-bit cell value is decoded into a real-world value. */
export type CriterionKind = 'distance' | 'noise' | 'count' | 'municipal' | 'category' | 'minutes' | 'scaled';

/**
 * Raw steps per unit of a scaled layer: raw 0 is no data, raw r is (r - 1) / steps. The air's are per
 * µg/m³; a turbine's distance is in its total heights.
 */
export const RAW_STEPS: Partial<Record<LayerName, number>> = { no2: 4, pm25: 10, turbine_heights: 10 };

/** Numbers Danmarks Statistik gives per municipality. */
export type MunicipalField = 'incomeTax' | 'landTax' | 'burglariesPer1000' | 'population';

/** A preference gives points; a requirement removes cells that do not meet it. */
export type Role = 'want' | 'must';

export type TravelMode = 'car' | 'bike' | 'walk' | 'transit';

export interface CategoryOption {
  value: number;
  label: string;
}

/** The curve fields shared by built-in criteria and the user's own places. */
export interface Curve {
  role: Role;
  /** 0 means the criterion is not used. */
  weight: number;
  /** Value that gives full points. */
  full: number;
  /** Value that gives no points (and the limit when the criterion is a requirement). */
  zero: number;
}

export type CriterionGroup = 'Nature' | 'Peace and quiet' | 'Everyday life' | 'Area and economy';

export interface Criterion extends Curve {
  id: string;
  name: string;
  /** The name when the block is turned around, e.g. "Noisy" for "Quiet". */
  opposite?: string;
  note: string;
  group: CriterionGroup;
  kind: CriterionKind;
  layer?: LayerName;
  field?: MunicipalField;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: CategoryOption[];
  allowed?: number[];
}

/** A point the user cares about, such as work or family. Groups use it through "Your place" blocks. */
export interface Place {
  id: string;
  name: string;
  lng: number;
  lat: number;
}

export interface Municipality {
  index: number;
  code: string;
  name: string;
  incomeTax: number;
  landTax: number;
  population: number;
  burglariesPer1000: number;
}

export interface GridMeta {
  built: string;
  /** The pack's id when the app's data jobs built it: its files are also at data-packs/<pack>/, for good. */
  pack?: string;
  /** The area the data covers, e.g. all of Denmark. */
  region?: { id: string; name: string };
  width: number;
  height: number;
  bounds: { west: number; south: number; east: number; north: number };
  /** The display grid's cell size. */
  cellMetres: number;
  /** The cell size the data was built on, when it differs from the display grid's. */
  gridMetres?: number;
  distanceMax: number;
  files: Record<string, string>;
  /** The grid's own cells for the map zoomed in, where the display grid is coarser (pipeline grid step). */
  tiles?: DetailTiles;
  municipalities: Municipality[];
  counts: Record<string, number>;
  basemap: { parts: number; chunkSize: number; size: number };
}

/**
 * Tiles of size × size cells at the grid's cell size, aligned with the display grid. Each tile holds
 * every layer, one after the other in the order of `layers`; only the tiles with land are there.
 */
export interface DetailTiles {
  cellMetres: number;
  size: number;
  columns: number;
  rows: number;
  /** The top left corner, in Web Mercator metres (EPSG:3857). */
  origin: { x: number; y: number };
  /** Web Mercator metres per cell. */
  pixel: number;
  layers: LayerName[];
  /** "column-row" of every tile there is. */
  available: string[];
}

export interface Grid {
  meta: GridMeta;
  width: number;
  height: number;
  layers: Record<LayerName, Uint8Array>;
  /** Indexed by municipality index (1-based); index 0 is outside the region. */
  municipalities: (Municipality | undefined)[];
  homeCells: Uint32Array;
  landCells: Uint32Array;
}

/** The heatmap's colour scales (the frontend's map/colours.ts holds their colours). */
export type HeatPalette = 'orange' | 'azure' | 'violet' | 'rose' | 'red-green';

export interface ViewState {
  show: 'all' | 'top' | 'abs';
  top: number;
  abs: number;
  smooth: 0 | 1 | 2;
  cells: 'homes' | 'land';
  showBelow: boolean;
  opacity: number;
  palette: HeatPalette;
  /** A smooth colour scale, or five steps of it. */
  bands: 'smooth' | 'steps';
}


export const DEFAULT_CRITERIA: Criterion[] = [
  { id: 'forest', group: 'Nature', name: 'Forest', opposite: 'Away from forest', note: 'Nearest wood of at least 5 ha.', kind: 'distance', layer: 'forest', role: 'want', weight: 4, full: 300, zero: 3000 },
  { id: 'water', group: 'Nature', name: 'Lake or sea', opposite: 'Away from lakes and sea', note: 'Nearest lake of at least 5 ha, or the coast.', kind: 'distance', layer: 'water', role: 'want', weight: 2, full: 300, zero: 3000 },
  { id: 'beach', group: 'Nature', name: 'Beach', opposite: 'Away from beaches', note: 'Nearest beach in OpenStreetMap.', kind: 'distance', layer: 'beach', role: 'want', weight: 1, full: 1000, zero: 10000 },
  { id: 'natura2000', group: 'Nature', name: 'Near protected nature', opposite: 'Away from protected nature', note: 'Nearest Natura 2000 area, for habitats or birds, from Miljøstyrelsen.', kind: 'distance', layer: 'natura2000', role: 'want', weight: 1, full: 1000, zero: 5000 },
  { id: 'protected_area', group: 'Nature', name: 'Near a protected area', opposite: 'Away from protected areas', note: 'Nearest fredning of land in force, of landscapes and nature, from Miljøstyrelsen.', kind: 'distance', layer: 'protected_area', role: 'want', weight: 1, full: 500, zero: 3000 },
  { id: 'noise', group: 'Peace and quiet', name: 'Quiet', opposite: 'Noisy', note: 'Noise from roads, railways, airports and industry, Lden in dB.', kind: 'noise', layer: 'noise', role: 'want', weight: 4, full: 45, zero: 65 },
  { id: 'supermarket', group: 'Everyday life', name: 'Supermarket', opposite: 'Away from supermarkets', note: 'Nearest supermarket.', kind: 'distance', layer: 'supermarket', role: 'want', weight: 2, full: 500, zero: 5000 },
  { id: 'school', group: 'Everyday life', name: 'School', opposite: 'Away from schools', note: 'Nearest folkeskole, friskole or private school.', kind: 'distance', layer: 'school', role: 'want', weight: 2, full: 1000, zero: 5000 },
  { id: 'daycare', group: 'Everyday life', name: 'Daycare', opposite: 'Away from daycare', note: 'Nearest daycare unit.', kind: 'distance', layer: 'daycare', role: 'want', weight: 2, full: 500, zero: 4000 },
  { id: 'station', group: 'Everyday life', name: 'Train or light rail', opposite: 'Away from railways', note: 'Nearest station.', kind: 'distance', layer: 'station', role: 'want', weight: 1, full: 1000, zero: 10000 },
  { id: 'pharmacy', group: 'Everyday life', name: 'Pharmacy', opposite: 'Away from pharmacies', note: 'Nearest pharmacy, from OpenStreetMap.', kind: 'distance', layer: 'pharmacy', role: 'want', weight: 1, full: 1000, zero: 5000 },
  { id: 'library', group: 'Everyday life', name: 'Library', opposite: 'Away from libraries', note: 'Nearest public library, from OpenStreetMap.', kind: 'distance', layer: 'library', role: 'want', weight: 1, full: 1000, zero: 5000 },
  {
    // Denmark ranges from about 3 to 13 µg/m³ (median 4.2); WHO's guideline is 10
    id: 'no2', group: 'Nature', name: 'Clean air', opposite: 'Polluted air', note: 'Nitrogen dioxide (NO₂), yearly mean 2024 on a 1 km grid, from DCE.',
    kind: 'scaled', layer: 'no2', unit: 'µg/m³', min: 0, max: 15, step: 0.1, role: 'want', weight: 2, full: 3.5, zero: 7,
  },
  {
    // Denmark ranges from about 5.5 to 7.7 µg/m³; WHO's guideline is 5
    id: 'pm25', group: 'Nature', name: 'Few fine particles', opposite: 'Many fine particles', note: 'Fine particles (PM2.5), yearly mean 2024 on a 1 km grid, from DCE.',
    kind: 'scaled', layer: 'pm25', unit: 'µg/m³', min: 0, max: 10, step: 0.1, role: 'want', weight: 1, full: 6, zero: 7.5,
  },
  { id: 'turbine', group: 'Peace and quiet', name: 'Away from wind turbines', opposite: 'Close to wind turbines', note: 'Nearest turbine in operation.', kind: 'distance', layer: 'turbine', role: 'want', weight: 1, full: 2000, zero: 500 },
  {
    id: 'turbine_heights', group: 'Peace and quiet', name: 'Away from wind turbines, by height', opposite: 'Close to wind turbines, by height',
    note: 'Distance to the nearest turbine in its total heights; Danish rules keep 4 from a neighbour.',
    kind: 'scaled', layer: 'turbine_heights', unit: 'heights', min: 0, max: 25, step: 0.5, role: 'want', weight: 1, full: 10, zero: 4,
  },
  { id: 'solar', group: 'Peace and quiet', name: 'Away from solar parks', opposite: 'Close to solar parks', note: 'Nearest solar park of at least 1 ha, from OpenStreetMap.', kind: 'distance', layer: 'solar', role: 'want', weight: 1, full: 1000, zero: 300 },
  { id: 'airport', group: 'Peace and quiet', name: 'Away from airports', opposite: 'Close to an airport', note: 'Nearest airport with an IATA code, such as Billund or Kastrup, from OpenStreetMap.', kind: 'distance', layer: 'airport', role: 'want', weight: 1, full: 10000, zero: 3000 },
  { id: 'airfield', group: 'Peace and quiet', name: 'Away from airfields', opposite: 'Close to an airfield', note: 'Nearest airfield of any kind, down to gliding and microlight fields, from OpenStreetMap.', kind: 'distance', layer: 'airfield', role: 'want', weight: 1, full: 3000, zero: 1000 },
  { id: 'air_station', group: 'Peace and quiet', name: 'Away from air stations', opposite: 'Close to an air station', note: "Nearest of the air force's stations: Aalborg, Karup and Skrydstrup.", kind: 'distance', layer: 'air_station', role: 'want', weight: 1, full: 15000, zero: 5000 },
  { id: 'density', group: 'Peace and quiet', name: 'Rural rather than urban', opposite: 'Urban rather than rural', note: 'Number of addresses within 300 m.', kind: 'count', layer: 'density', role: 'want', weight: 1, full: 20, zero: 250 },
  { id: 'incomeTax', group: 'Area and economy', name: 'Low municipal tax', opposite: 'High municipal tax', note: 'Income tax per municipality, 2026.', kind: 'municipal', field: 'incomeTax', unit: '%', min: 24, max: 26.5, step: 0.1, role: 'want', weight: 1, full: 24.6, zero: 26.0 },
  { id: 'burglary', group: 'Area and economy', name: 'Few home burglaries', opposite: 'Many home burglaries', note: 'Reported per 1,000 residents per municipality, 2025.', kind: 'municipal', field: 'burglariesPer1000', unit: 'per 1,000', min: 1, max: 5, step: 0.1, role: 'want', weight: 1, full: 2.5, zero: 4.5 },
  {
    id: 'zone', group: 'Area and economy', name: 'Planning zone', note: 'Homes in a sommerhusområde cannot be lived in all year.', kind: 'category', layer: 'zone',
    role: 'must', weight: 1, full: 0, zero: 0,
    options: [{ value: 1, label: 'Byzone' }, { value: 2, label: 'Landzone' }, { value: 3, label: 'Sommerhusområde' }],
    allowed: [1, 2],
  },
];

export const DEFAULT_VIEW: ViewState = { show: 'all', top: 20, abs: 60, smooth: 1, cells: 'homes', showBelow: false, opacity: 0.85, palette: 'red-green', bands: 'smooth' };

/** The places' pins; white reads on each at 4.5:1 or more. */
export const PLACE_COLOURS = ['#1f6feb', '#8a3ffc', '#007d79', '#d12771', '#946f00'];

export const CRITERION_GROUPS: CriterionGroup[] = ['Nature', 'Peace and quiet', 'Everyday life', 'Area and economy'];

/** Quick picks offered while nothing has been chosen yet. */
export const SUGGESTED = ['forest', 'noise', 'supermarket', 'school', 'station'];

/** Typical travel times (full points, no points) per mode. */
export const MODE_MINUTES: Record<TravelMode, [number, number]> = { car: [15, 45], bike: [10, 40], walk: [10, 30], transit: [20, 60] };
