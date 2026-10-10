/**
 * The values a block's code can read: the data layers, the statistics per municipality and
 * the travel times to the user's own places.
 */
import { formatDistance } from './format.ts';
import { ENGLISH, formatNumber, word, type Wording } from './wording.ts';
import { toVariableName } from './formula.ts';
import { type CriterionKind, type LayerName, type MunicipalField, type Place, type TravelMode } from './types.ts';

export type ValueGroup = 'Nature' | 'Peace and quiet' | 'Infrastructure and plans' | 'Everyday life' | 'Area and economy' | 'Your places';

export interface ValueInfo {
  /** What the code calls it, e.g. "forest" or "work_car". */
  name: string;
  label: string;
  unit: string;
  group: ValueGroup;
  kind: CriterionKind;
  layer?: LayerName;
  field?: MunicipalField;
  place?: { id: string; mode: TravelMode };
}

export const DATA_VALUES: ValueInfo[] = [
  { name: 'forest', label: 'Distance to a wood of at least 5 ha', unit: 'm', group: 'Nature', kind: 'distance', layer: 'forest' },
  { name: 'water', label: 'Distance to a lake of at least 5 ha, or the sea', unit: 'm', group: 'Nature', kind: 'distance', layer: 'water' },
  { name: 'beach', label: 'Distance to a beach', unit: 'm', group: 'Nature', kind: 'distance', layer: 'beach' },
  { name: 'natura2000', label: 'Distance to a Natura 2000 area for habitats or birds (0 inside one)', unit: 'm', group: 'Nature', kind: 'distance', layer: 'natura2000' },
  { name: 'protected_area', label: 'Distance to a protected area, a fredning of land in force (0 inside one)', unit: 'm', group: 'Nature', kind: 'distance', layer: 'protected_area' },
  { name: 'noise', label: 'Noise from roads, railways, airports and industry, Lden', unit: 'dB', group: 'Peace and quiet', kind: 'noise', layer: 'noise' },
  { name: 'no2', label: 'Nitrogen dioxide (NO₂), yearly mean 2024 (no data at sea)', unit: 'µg/m³', group: 'Nature', kind: 'scaled', layer: 'no2' },
  { name: 'pm25', label: 'Fine particles (PM2.5), yearly mean 2024 (no data at sea)', unit: 'µg/m³', group: 'Nature', kind: 'scaled', layer: 'pm25' },
  { name: 'turbine', label: 'Distance to a wind turbine in operation', unit: 'm', group: 'Infrastructure and plans', kind: 'distance', layer: 'turbine' },
  { name: 'turbine_heights', label: 'Distance to a wind turbine in operation, in its total heights (25.4 or more where none is near)', unit: 'heights', group: 'Infrastructure and plans', kind: 'scaled', layer: 'turbine_heights' },
  { name: 'solar', label: 'Distance to a solar park of at least 1 ha', unit: 'm', group: 'Infrastructure and plans', kind: 'distance', layer: 'solar' },
  { name: 'planned_road', label: 'Distance to a road or railway the municipal plans lay out, adopted or proposed', unit: 'm', group: 'Infrastructure and plans', kind: 'distance', layer: 'planned_road' },
  { name: 'new_local_plan', label: 'Distance to a local plan of the last two years, proposed or adopted (0 inside one)', unit: 'm', group: 'Infrastructure and plans', kind: 'distance', layer: 'new_local_plan' },
  { name: 'consequence_zone', label: 'Distance to a zone the plans draw around a business or technical plant (0 inside one)', unit: 'm', group: 'Infrastructure and plans', kind: 'distance', layer: 'consequence_zone' },
  { name: 'extraction_area', label: 'Distance to an area the regions’ raw material plans set aside for digging (0 inside one)', unit: 'm', group: 'Infrastructure and plans', kind: 'distance', layer: 'extraction_area' },
  { name: 'power_line', label: 'Distance to an overhead power line of 132 kV or more', unit: 'm', group: 'Infrastructure and plans', kind: 'distance', layer: 'power_line' },
  { name: 'airport', label: 'Distance to an airport (one with an IATA code)', unit: 'm', group: 'Infrastructure and plans', kind: 'distance', layer: 'airport' },
  { name: 'airfield', label: 'Distance to an airfield of any kind, also gliding and microlight fields', unit: 'm', group: 'Infrastructure and plans', kind: 'distance', layer: 'airfield' },
  { name: 'air_station', label: 'Distance to a military air station', unit: 'm', group: 'Infrastructure and plans', kind: 'distance', layer: 'air_station' },
  { name: 'density', label: 'Addresses within 300 m', unit: 'addresses', group: 'Peace and quiet', kind: 'count', layer: 'density' },
  { name: 'supermarket', label: 'Distance to a supermarket', unit: 'm', group: 'Everyday life', kind: 'distance', layer: 'supermarket' },
  { name: 'school', label: 'Distance to a folkeskole, friskole or private school', unit: 'm', group: 'Everyday life', kind: 'distance', layer: 'school' },
  { name: 'daycare', label: 'Distance to a daycare unit', unit: 'm', group: 'Everyday life', kind: 'distance', layer: 'daycare' },
  { name: 'station', label: 'Distance to a train or light rail station', unit: 'm', group: 'Everyday life', kind: 'distance', layer: 'station' },
  { name: 'pharmacy', label: 'Distance to a pharmacy', unit: 'm', group: 'Everyday life', kind: 'distance', layer: 'pharmacy' },
  { name: 'library', label: 'Distance to a public library', unit: 'm', group: 'Everyday life', kind: 'distance', layer: 'library' },
  { name: 'zone', label: 'Planning zone: BYZONE, LANDZONE or SOMMERHUS', unit: '', group: 'Area and economy', kind: 'category', layer: 'zone' },
  { name: 'district_heating', label: 'Distance to an area the heat plans give district heating (0 inside one)', unit: 'm', group: 'Area and economy', kind: 'distance', layer: 'district_heating' },
  { name: 'income_tax', label: 'Municipal income tax, 2026', unit: '%', group: 'Area and economy', kind: 'municipal', field: 'incomeTax' },
  { name: 'land_tax', label: 'Land tax, 2026', unit: '‰', group: 'Area and economy', kind: 'municipal', field: 'landTax' },
  { name: 'burglaries', label: 'Home burglaries per 1,000 residents, 2025', unit: 'per 1,000', group: 'Area and economy', kind: 'municipal', field: 'burglariesPer1000' },
  { name: 'population', label: 'Residents of the municipality', unit: '', group: 'Area and economy', kind: 'municipal', field: 'population' },
  { name: 'income', label: 'Mean disposable income per resident of the municipality, 2024', unit: 'kr.', group: 'Area and economy', kind: 'municipal', field: 'income' },
  { name: 'nursery_price', label: 'Yearly rate for a municipal nursery place (0–2 years), 2026', unit: 'kr.', group: 'Area and economy', kind: 'municipal', field: 'nurseryPrice' },
  { name: 'class_size', label: 'Pupils per class in the folkeskoler of the municipality, 2025', unit: 'pupils', group: 'Everyday life', kind: 'municipal', field: 'classSize' },
];

export const MODES: { mode: TravelMode; suffix: string }[] = [
  { mode: 'car', suffix: 'car' }, { mode: 'bike', suffix: 'bike' }, { mode: 'walk', suffix: 'walk' }, { mode: 'transit', suffix: 'train' },
];

/** The value name of a place's travel time, e.g. "work_car". */
export function placeValueName(place: Pick<Place, 'name'>, mode: TravelMode): string {
  return `${toVariableName(place.name)}_${MODES.find((m) => m.mode === mode)!.suffix}`;
}

export function placeValues(places: Place[]): ValueInfo[] {
  return places.flatMap((p) => MODES.map(({ mode, suffix }) => ({
    name: placeValueName(p, mode),
    // By train it is estimated from the distance; the others come from the road network where the server has one
    label: `Minutes to ${p.name} by ${suffix}${mode === 'transit' ? ' (estimate)' : ''}`,
    unit: 'min',
    group: 'Your places' as const,
    kind: 'minutes' as const,
    place: { id: p.id, mode },
  })));
}

const ZONES: Record<number, string> = { 1: 'Byzone', 2: 'Landzone', 3: 'Sommerhusområde' };

/** A value for people, e.g. "520 m", "57 dB" or "Landzone". */
export function formatValueOf(info: Pick<ValueInfo, 'kind' | 'unit' | 'field'>, value: number, wording: Wording = ENGLISH): string {
  if (Number.isNaN(value)) return wording.noData;
  const unit = word(wording, info.unit);
  switch (info.kind) {
    case 'distance': return formatDistance(value, wording);
    case 'category': return ZONES[value] ?? String(value);
    case 'minutes': return value >= 255 ? wording.hoursOrMore : `${Math.round(value)} min`;
    case 'scaled': return `${formatNumber(value, wording, 1)} ${unit}`;
    case 'municipal':
      if (info.field === 'population') return Math.round(value).toLocaleString(wording.locale);
      if (info.field === 'income' || info.field === 'nurseryPrice') return `${Math.round(value).toLocaleString(wording.locale)} ${unit}`;
      return `${formatNumber(value, wording, info.field === 'incomeTax' ? 2 : 1)} ${unit}`;
    default: return `${Math.round(value)} ${unit}`.trim();
  }
}

/** A control value with its unit: distances in m or km, the rest as written. */
export function formatWithUnit(value: number, unit: string, wording: Wording = ENGLISH): string {
  if (unit === 'm') return formatDistance(value, wording);
  // Amounts such as 320,000 kr. are grouped; the rest, which are small, are not
  const text = Math.abs(value) >= 10_000 ? Math.round(value).toLocaleString(wording.locale) : formatNumber(Math.round(value * 1000) / 1000, wording, 0, 3);
  return unit ? `${text} ${word(wording, unit)}` : text;
}
