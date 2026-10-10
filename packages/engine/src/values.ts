/**
 * The values a block's code can read: the data layers, the statistics per municipality and
 * the travel times to the user's own places.
 */
import { formatDistance } from './format.ts';
import { toVariableName } from './formula.ts';
import { type CriterionKind, type LayerName, type MunicipalField, type Place, type TravelMode } from './types.ts';

export type ValueGroup = 'Nature' | 'Peace and quiet' | 'Everyday life' | 'Area and economy' | 'Your places';

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
  { name: 'noise', label: 'Noise from roads, railways, airports and industry, Lden', unit: 'dB', group: 'Peace and quiet', kind: 'noise', layer: 'noise' },
  { name: 'no2', label: 'Nitrogen dioxide (NO₂), yearly mean 2024 (no data at sea)', unit: 'µg/m³', group: 'Nature', kind: 'scaled', layer: 'no2' },
  { name: 'pm25', label: 'Fine particles (PM2.5), yearly mean 2024 (no data at sea)', unit: 'µg/m³', group: 'Nature', kind: 'scaled', layer: 'pm25' },
  { name: 'turbine', label: 'Distance to a wind turbine in operation', unit: 'm', group: 'Peace and quiet', kind: 'distance', layer: 'turbine' },
  { name: 'turbine_heights', label: 'Distance to a wind turbine in operation, in its total heights (25.4 or more where none is near)', unit: 'heights', group: 'Peace and quiet', kind: 'scaled', layer: 'turbine_heights' },
  { name: 'solar', label: 'Distance to a solar park of at least 1 ha', unit: 'm', group: 'Peace and quiet', kind: 'distance', layer: 'solar' },
  { name: 'density', label: 'Addresses within 300 m', unit: 'addresses', group: 'Peace and quiet', kind: 'count', layer: 'density' },
  { name: 'supermarket', label: 'Distance to a supermarket', unit: 'm', group: 'Everyday life', kind: 'distance', layer: 'supermarket' },
  { name: 'school', label: 'Distance to a folkeskole, friskole or private school', unit: 'm', group: 'Everyday life', kind: 'distance', layer: 'school' },
  { name: 'daycare', label: 'Distance to a daycare unit', unit: 'm', group: 'Everyday life', kind: 'distance', layer: 'daycare' },
  { name: 'station', label: 'Distance to a train or light rail station', unit: 'm', group: 'Everyday life', kind: 'distance', layer: 'station' },
  { name: 'zone', label: 'Planning zone: BYZONE, LANDZONE or SOMMERHUS', unit: '', group: 'Area and economy', kind: 'category', layer: 'zone' },
  { name: 'income_tax', label: 'Municipal income tax, 2026', unit: '%', group: 'Area and economy', kind: 'municipal', field: 'incomeTax' },
  { name: 'land_tax', label: 'Land tax, 2026', unit: '‰', group: 'Area and economy', kind: 'municipal', field: 'landTax' },
  { name: 'burglaries', label: 'Home burglaries per 1,000 residents, 2025', unit: 'per 1,000', group: 'Area and economy', kind: 'municipal', field: 'burglariesPer1000' },
  { name: 'population', label: 'Residents of the municipality', unit: '', group: 'Area and economy', kind: 'municipal', field: 'population' },
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
export function formatValueOf(info: Pick<ValueInfo, 'kind' | 'unit' | 'field'>, value: number): string {
  if (Number.isNaN(value)) return 'no data';
  switch (info.kind) {
    case 'distance': return formatDistance(value);
    case 'category': return ZONES[value] ?? String(value);
    case 'minutes': return value >= 255 ? '4 h or more' : `${Math.round(value)} min`;
    case 'scaled': return `${value.toFixed(1)} ${info.unit}`;
    case 'municipal':
      if (info.field === 'population') return Math.round(value).toLocaleString('en-US');
      return `${value.toFixed(info.field === 'incomeTax' ? 2 : 1)} ${info.unit}`;
    default: return `${Math.round(value)} ${info.unit}`.trim();
  }
}

/** A control value with its unit: distances in m or km, the rest as written. */
export function formatWithUnit(value: number, unit: string): string {
  if (unit === 'm') return formatDistance(value);
  const text = String(Math.round(value * 1000) / 1000);
  return unit ? `${text} ${unit}` : text;
}
