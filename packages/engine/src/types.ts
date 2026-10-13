/** Shared types and defaults for the scoring engine and the UI. */
import type { Sites } from './sites.ts';

export type LayerName =
  | 'forest' | 'water' | 'beach' | 'noise' | 'supermarket' | 'school' | 'daycare'
  | 'station' | 'departures' | 'pharmacy' | 'library' | 'turbine' | 'turbine_heights' | 'solar' | 'power_line' | 'airport' | 'airfield' | 'air_station' | 'protected_area'
  | 'natura2000' | 'building_line' | 'planned_road' | 'new_local_plan' | 'consequence_zone' | 'extraction_area' | 'extraction_interest' | 'district_heating' | 'density' | 'zone' | 'municipality' | 'no2' | 'pm25' | 'water_hardness' | 'elevation' | 'mask';

/** How a raw 8-bit cell value is decoded into a real-world value. */
export type CriterionKind = 'distance' | 'noise' | 'count' | 'municipal' | 'category' | 'minutes' | 'scaled';

/**
 * Raw steps per unit of a scaled layer: raw 0 is no data, raw r is (r - 1) / steps + its offset. The
 * air's are per µg/m³; a turbine's distance is in its total heights; the height above sea level is in
 * whole metres from -10 m, as some land lies below the sea.
 */
export const RAW_STEPS: Partial<Record<LayerName, number>> = { no2: 4, pm25: 10, turbine_heights: 10, water_hardness: 5, elevation: 1 };
/** The value of raw 1 in a scaled layer, where it is not 0. */
export const RAW_OFFSET: Partial<Record<LayerName, number>> = { elevation: -10 };

/** Numbers Danmarks Statistik gives per municipality. */
export type MunicipalField = 'incomeTax' | 'landTax' | 'burglariesPer1000' | 'population' | 'income' | 'nurseryPrice' | 'classSize';

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

export type CriterionGroup = 'Nature' | 'Peace and quiet' | 'Infrastructure and plans' | 'Everyday life' | 'Area and economy';

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
  /** Reads the distance to points the browser measures, with a switch per operator: the chargers. */
  sites?: 'chargers';
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
  /** The mean disposable income of its residents, in kroner; missing where the statistics have none yet. */
  income?: number;
  /** The yearly rate of a municipal nursery place (0-2 years), in kroner, where it has one. */
  nurseryPrice?: number;
  /** The pupils per class in its folkeskoler. */
  classSize?: number;
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
  /** Points whose distances the browser finds itself, by what they are: chargers.json. */
  sites?: { chargers?: string };
  /** The grid's own cells for the map zoomed in, where the display grid is coarser (pipeline grid step). */
  tiles?: DetailTiles;
  municipalities: Municipality[];
  counts: Record<string, number>;
  basemap: { parts: number; chunkSize: number; size: number };
  /** The terrain's tiles (the terrain step), which the map shades the land with; packs before it have none. */
  terrain?: { parts: number; chunkSize: number; size: number };
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
  /** The points of the data pack's `sites`, where it has them. */
  sites?: { chargers?: Sites };
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
  /** Under the heatmap: the map, or the map with the land shaded by its terrain. */
  background: 'map' | 'terrain';
}


export const DEFAULT_CRITERIA: Criterion[] = [
  { id: 'forest', group: 'Nature', name: 'Forest', opposite: 'Away from forest', note: 'Nearest wood of at least 5 ha.', kind: 'distance', layer: 'forest', role: 'want', weight: 4, full: 300, zero: 3000 },
  { id: 'water', group: 'Nature', name: 'Lake or sea', opposite: 'Away from lakes and sea', note: 'Nearest lake of at least 5 ha, or the coast.', kind: 'distance', layer: 'water', role: 'want', weight: 2, full: 300, zero: 3000 },
  { id: 'beach', group: 'Nature', name: 'Beach', opposite: 'Away from beaches', note: 'Nearest beach in OpenStreetMap.', kind: 'distance', layer: 'beach', role: 'want', weight: 1, full: 1000, zero: 10000 },
  { id: 'natura2000', group: 'Nature', name: 'Near protected nature', opposite: 'Away from protected nature', note: 'Nearest Natura 2000 area, for habitats or birds, from Miljøstyrelsen.', kind: 'distance', layer: 'natura2000', role: 'want', weight: 1, full: 1000, zero: 5000 },
  {
    // Copernicus' surface model also measures roofs and treetops; the cell's lowest quarter is mostly the ground
    id: 'elevation', group: 'Nature', name: 'High ground', opposite: 'Low ground',
    note: 'Height above sea level, from the Copernicus elevation model of 30 m: the low part of each cell, mostly the ground between houses; in a forest the treetops may lift it.',
    kind: 'scaled', layer: 'elevation', unit: 'm a.s.l.', min: -10, max: 175, step: 1, role: 'want', weight: 1, full: 10, zero: 2,
  },
  { id: 'protected_area', group: 'Nature', name: 'Near a protected area', opposite: 'Away from protected areas', note: 'Nearest fredning of land in force, of landscapes and nature, from Miljøstyrelsen.', kind: 'distance', layer: 'protected_area', role: 'want', weight: 1, full: 500, zero: 3000 },
  { id: 'noise', group: 'Peace and quiet', name: 'Quiet', opposite: 'Noisy', note: 'Noise from roads, railways, airports and industry, Lden in dB.', kind: 'noise', layer: 'noise', role: 'want', weight: 4, full: 45, zero: 65 },
  { id: 'supermarket', group: 'Everyday life', name: 'Supermarket', opposite: 'Away from supermarkets', note: 'Nearest supermarket.', kind: 'distance', layer: 'supermarket', role: 'want', weight: 2, full: 500, zero: 5000 },
  { id: 'school', group: 'Everyday life', name: 'School', opposite: 'Away from schools', note: 'Nearest folkeskole, friskole or private school.', kind: 'distance', layer: 'school', role: 'want', weight: 2, full: 1000, zero: 5000 },
  { id: 'daycare', group: 'Everyday life', name: 'Daycare', opposite: 'Away from daycare', note: 'Nearest daycare unit.', kind: 'distance', layer: 'daycare', role: 'want', weight: 2, full: 500, zero: 4000 },
  { id: 'classSize', group: 'Everyday life', name: 'Small classes', opposite: 'Large classes', note: 'Pupils per class in the municipality’s folkeskoler, 2025, from Danmarks Statistik.', kind: 'municipal', field: 'classSize', unit: 'pupils', min: 10, max: 28, step: 0.5, role: 'want', weight: 1, full: 18, zero: 23 },
  { id: 'station', group: 'Everyday life', name: 'Train or light rail', opposite: 'Away from railways', note: 'Nearest station.', kind: 'distance', layer: 'station', role: 'want', weight: 1, full: 1000, zero: 10000 },
  { id: 'pharmacy', group: 'Everyday life', name: 'Pharmacy', opposite: 'Away from pharmacies', note: 'Nearest pharmacy, from OpenStreetMap.', kind: 'distance', layer: 'pharmacy', role: 'want', weight: 1, full: 1000, zero: 5000 },
  {
    id: 'charger', group: 'Everyday life', name: 'EV charger', opposite: 'Away from EV chargers',
    note: 'Nearest public charger for electric cars of the providers ticked, from GeoFA, where the operators report them, and OpenStreetMap.',
    kind: 'distance', sites: 'chargers', role: 'want', weight: 1, full: 500, zero: 3000,
  },
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
  { id: 'turbine', group: 'Infrastructure and plans', name: 'Away from wind turbines', opposite: 'Close to wind turbines', note: 'Nearest turbine in operation.', kind: 'distance', layer: 'turbine', role: 'want', weight: 1, full: 2000, zero: 500 },
  {
    id: 'turbine_heights', group: 'Infrastructure and plans', name: 'Away from wind turbines, by height', opposite: 'Close to wind turbines, by height',
    note: 'Distance to the nearest turbine in its total heights; Danish rules keep 4 from a neighbour.',
    kind: 'scaled', layer: 'turbine_heights', unit: 'heights', min: 0, max: 25, step: 0.5, role: 'want', weight: 1, full: 10, zero: 4,
  },
  { id: 'solar', group: 'Infrastructure and plans', name: 'Away from solar parks', opposite: 'Close to solar parks', note: 'Nearest solar park of at least 1 ha, from OpenStreetMap.', kind: 'distance', layer: 'solar', role: 'want', weight: 1, full: 1000, zero: 300 },
  { id: 'planned_road', group: 'Infrastructure and plans', name: 'Away from planned roads and railways', opposite: 'Close to planned roads and railways', note: 'Nearest road or railway the municipal plans lay out, adopted or proposed, from Plandata.dk.', kind: 'distance', layer: 'planned_road', role: 'want', weight: 1, full: 1000, zero: 200 },
  { id: 'new_local_plan', group: 'Infrastructure and plans', name: 'Away from new local plans', opposite: 'Close to new local plans', note: 'Nearest local plan of the last two years, proposed or adopted: building or change to come, from Plandata.dk.', kind: 'distance', layer: 'new_local_plan', role: 'want', weight: 1, full: 1000, zero: 200 },
  { id: 'consequence_zone', group: 'Infrastructure and plans', name: 'Away from consequence zones', opposite: 'Close to consequence zones', note: 'Nearest zone the plans draw around a business or plant that smells, makes noise or is a risk, from Plandata.dk.', kind: 'distance', layer: 'consequence_zone', role: 'want', weight: 1, full: 500, zero: 100 },
  { id: 'extraction_area', group: 'Infrastructure and plans', name: 'Away from gravel pits', opposite: 'Close to gravel pits', note: 'Nearest area the regions’ raw material plans set aside for digging sand, gravel or clay, from Danmarks Miljøportal.', kind: 'distance', layer: 'extraction_area', role: 'want', weight: 1, full: 1000, zero: 200 },
  { id: 'extraction_interest', group: 'Infrastructure and plans', name: 'Away from gravel pits to come', opposite: 'Close to gravel pits to come', note: 'Nearest area the regions’ raw material plans keep for digging later, from Danmarks Miljøportal.', kind: 'distance', layer: 'extraction_interest', role: 'want', weight: 1, full: 1000, zero: 200 },
  { id: 'power_line', group: 'Infrastructure and plans', name: 'Away from power lines', opposite: 'Close to power lines', note: 'Nearest overhead line of 132 to 400 kV, from OpenStreetMap.', kind: 'distance', layer: 'power_line', role: 'want', weight: 1, full: 500, zero: 100 },
  { id: 'airport', group: 'Infrastructure and plans', name: 'Away from airports', opposite: 'Close to an airport', note: 'Nearest airport with an IATA code, such as Billund or Kastrup, from OpenStreetMap.', kind: 'distance', layer: 'airport', role: 'want', weight: 1, full: 10000, zero: 3000 },
  { id: 'airfield', group: 'Infrastructure and plans', name: 'Away from airfields', opposite: 'Close to an airfield', note: 'Nearest airfield of any kind, down to gliding and microlight fields, from OpenStreetMap.', kind: 'distance', layer: 'airfield', role: 'want', weight: 1, full: 3000, zero: 1000 },
  { id: 'air_station', group: 'Infrastructure and plans', name: 'Away from air stations', opposite: 'Close to an air station', note: "Nearest of the air force's stations: Aalborg, Karup and Skrydstrup.", kind: 'distance', layer: 'air_station', role: 'want', weight: 1, full: 15000, zero: 5000 },
  { id: 'density', group: 'Peace and quiet', name: 'Rural rather than urban', opposite: 'Urban rather than rural', note: 'Number of addresses within 300 m.', kind: 'count', layer: 'density', role: 'want', weight: 1, full: 20, zero: 250 },
  { id: 'departures', group: 'Everyday life', name: 'Frequent public transport', opposite: 'Little public transport', note: 'Departures per hour between 7 and 9 on a weekday from the stops within 500 m, each trip once, from Rejseplanen.', kind: 'count', layer: 'departures', unit: 'per hour', max: 100, step: 1, role: 'want', weight: 1, full: 12, zero: 2 },
  { id: 'water_hardness', group: 'Everyday life', name: 'Soft water', opposite: 'Hard water', note: 'Hardness of the drinking water in the public waterworks’ supply areas, from GEUS (samples up to 2023). No data where homes have wells of their own.', kind: 'scaled', layer: 'water_hardness', unit: '°dH', min: 0, max: 30, step: 0.5, role: 'want', weight: 1, full: 8, zero: 18 },
  { id: 'district_heating', group: 'Area and economy', name: 'District heating', opposite: 'Outside district heating', note: 'Inside an area the heat plans give district heating, from Plandata.dk.', kind: 'distance', layer: 'district_heating', role: 'want', weight: 1, full: 0, zero: 200 },
  { id: 'building_line', group: 'Area and economy', name: 'Outside building lines', opposite: 'Inside building lines', note: 'Nearest building line around a forest, church, lake or stream, inside which building needs a dispensation, from Danmarks Miljøportal.', kind: 'distance', layer: 'building_line', role: 'want', weight: 1, full: 100, zero: 0 },
  { id: 'incomeTax', group: 'Area and economy', name: 'Low municipal tax', opposite: 'High municipal tax', note: 'Income tax per municipality, 2026.', kind: 'municipal', field: 'incomeTax', unit: '%', min: 24, max: 26.5, step: 0.1, role: 'want', weight: 1, full: 24.6, zero: 26.0 },
  { id: 'income', group: 'Area and economy', name: 'High incomes', opposite: 'Low incomes', note: 'Mean disposable income per resident of the municipality, 2024, from Danmarks Statistik.', kind: 'municipal', field: 'income', unit: 'kr.', min: 200000, max: 600000, step: 5000, role: 'want', weight: 1, full: 320000, zero: 260000 },
  { id: 'nurseryPrice', group: 'Area and economy', name: 'Low nursery prices', opposite: 'High nursery prices', note: 'Yearly rate for a municipal nursery place (0–2 years), 2026, from Danmarks Statistik.', kind: 'municipal', field: 'nurseryPrice', unit: 'kr.', min: 30000, max: 65000, step: 500, role: 'want', weight: 1, full: 40000, zero: 55000 },
  { id: 'burglary', group: 'Area and economy', name: 'Few home burglaries', opposite: 'Many home burglaries', note: 'Reported per 1,000 residents per municipality, 2025.', kind: 'municipal', field: 'burglariesPer1000', unit: 'per 1,000', min: 1, max: 5, step: 0.1, role: 'want', weight: 1, full: 2.5, zero: 4.5 },
  {
    id: 'zone', group: 'Area and economy', name: 'Planning zone', note: 'Homes in a sommerhusområde cannot be lived in all year.', kind: 'category', layer: 'zone',
    role: 'must', weight: 1, full: 0, zero: 0,
    options: [{ value: 1, label: 'Byzone' }, { value: 2, label: 'Landzone' }, { value: 3, label: 'Sommerhusområde' }],
    allowed: [1, 2],
  },
];

export const DEFAULT_VIEW: ViewState = { show: 'all', top: 20, abs: 60, smooth: 1, cells: 'homes', showBelow: false, opacity: 0.85, palette: 'red-green', bands: 'smooth', background: 'map' };

/** The places' pins; white reads on each at 4.5:1 or more. */
export const PLACE_COLOURS = ['#1f6feb', '#8a3ffc', '#007d79', '#d12771', '#946f00'];

export const CRITERION_GROUPS: CriterionGroup[] = ['Nature', 'Peace and quiet', 'Infrastructure and plans', 'Everyday life', 'Area and economy'];

/** Quick picks offered while nothing has been chosen yet. */
export const SUGGESTED = ['forest', 'noise', 'supermarket', 'school', 'station'];

/** Typical travel times (full points, no points) per mode. */
export const MODE_MINUTES: Record<TravelMode, [number, number]> = { car: [15, 45], bike: [10, 40], walk: [10, 30], transit: [20, 60] };
