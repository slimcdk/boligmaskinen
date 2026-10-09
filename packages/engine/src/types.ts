/** Shared types and defaults for the scoring engine and the UI. */

export type LayerName =
  | 'forest' | 'water' | 'beach' | 'noise' | 'supermarket' | 'school' | 'daycare'
  | 'station' | 'turbine' | 'density' | 'zone' | 'municipality' | 'mask';

/** How a raw 8-bit cell value is decoded into a real-world value. */
export type CriterionKind = 'distance' | 'noise' | 'count' | 'municipal' | 'category' | 'minutes';

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
  /** The area the data covers, e.g. all of Denmark. */
  region?: { id: string; name: string };
  width: number;
  height: number;
  bounds: { west: number; south: number; east: number; north: number };
  cellMetres: number;
  distanceMax: number;
  files: Record<string, string>;
  municipalities: Municipality[];
  counts: Record<string, number>;
  basemap: { parts: number; chunkSize: number; size: number };
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
  { id: 'noise', group: 'Peace and quiet', name: 'Quiet', opposite: 'Noisy', note: 'Road noise, Lden in dB.', kind: 'noise', layer: 'noise', role: 'want', weight: 4, full: 45, zero: 65 },
  { id: 'supermarket', group: 'Everyday life', name: 'Supermarket', opposite: 'Away from supermarkets', note: 'Nearest supermarket.', kind: 'distance', layer: 'supermarket', role: 'want', weight: 2, full: 500, zero: 5000 },
  { id: 'school', group: 'Everyday life', name: 'School', opposite: 'Away from schools', note: 'Nearest folkeskole, friskole or private school.', kind: 'distance', layer: 'school', role: 'want', weight: 2, full: 1000, zero: 5000 },
  { id: 'daycare', group: 'Everyday life', name: 'Daycare', opposite: 'Away from daycare', note: 'Nearest daycare unit.', kind: 'distance', layer: 'daycare', role: 'want', weight: 2, full: 500, zero: 4000 },
  { id: 'station', group: 'Everyday life', name: 'Train or light rail', opposite: 'Away from railways', note: 'Nearest station.', kind: 'distance', layer: 'station', role: 'want', weight: 1, full: 1000, zero: 10000 },
  { id: 'turbine', group: 'Peace and quiet', name: 'Away from wind turbines', opposite: 'Close to wind turbines', note: 'Nearest turbine in operation.', kind: 'distance', layer: 'turbine', role: 'want', weight: 1, full: 2000, zero: 500 },
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

export const PLACE_COLOURS = ['#1f6feb', '#8a3ffc', '#007d79', '#d12771', '#b28600'];

export const CRITERION_GROUPS: CriterionGroup[] = ['Nature', 'Peace and quiet', 'Everyday life', 'Area and economy'];

/** Quick picks offered while nothing has been chosen yet. */
export const SUGGESTED = ['forest', 'noise', 'supermarket', 'school', 'station'];

/** Typical travel times (full points, no points) per mode. */
export const MODE_MINUTES: Record<TravelMode, [number, number]> = { car: [15, 45], bike: [10, 40], walk: [10, 30], transit: [20, 60] };
