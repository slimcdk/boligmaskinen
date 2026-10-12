/** What a pack's meta.json says about the data, as far as the checks read it. */
export interface PackFacts {
  region?: { id?: string };
  cellMetres?: number;
  gridMetres?: number;
  counts?: Record<string, number>;
}

/** A count that changed more than a person would expect from one build to the next. */
export interface LargeChange {
  key: string;
  before: number;
  after: number;
}

/**
 * How much each count may change from one pack to the next: a quarter, and always a few. A source
 * that breaks (an empty answer, a changed format) moves its count far more than that; the sources
 * themselves move a few percent a month.
 */
const SHARE = 0.25;
/** The smallest change that counts as large, for counts and for shares (0–1). */
const AT_LEAST = { count: 5, share: 0.01 };

/** What the counts in meta.json are called, for the message. */
const NAMES: Record<string, string> = {
  addresses: 'addresses', homeCells: 'cells with homes', regionLandCells: 'land cells', supermarkets: 'supermarkets', stations: 'stations',
  schools: 'schools', daycare: 'daycare units', turbines: 'wind turbines', mstShareOfRegion: 'the share of land with mapped noise',
  chargersGeofa: 'EV chargers from GeoFA', chargersOsm: 'EV chargers from OpenStreetMap',
};

/**
 * The counts that changed a lot since the pack in use. Packs of another region or cell size are not
 * compared: everything changes then.
 */
export function largeChanges(before: PackFacts, after: PackFacts): LargeChange[] | 'not comparable' {
  if (before.region?.id !== after.region?.id || before.cellMetres !== after.cellMetres || (before.gridMetres ?? 100) !== (after.gridMetres ?? 100)) {
    return 'not comparable';
  }
  const changes: LargeChange[] = [];
  for (const [key, was] of Object.entries(before.counts ?? {})) {
    const now = after.counts?.[key];
    if (now === undefined) continue;
    const least = key.endsWith('Share') || key.includes('ShareOf') ? AT_LEAST.share : AT_LEAST.count;
    if (Math.abs(now - was) > Math.max(SHARE * Math.abs(was), least)) changes.push({ key, before: was, after: now });
  }
  return changes;
}

const format = (key: string, n: number) => (key.includes('Share') ? `${(n * 100).toFixed(1)} %` : n.toLocaleString('en-US'));

/** "schools fell from 1,963 to 12 (−99 %)". */
export function describeChange({ key, before, after }: LargeChange): string {
  const percent = before ? Math.round(((after - before) / before) * 100) : null;
  return `${NAMES[key] ?? key} ${after < before ? 'fell' : 'rose'} from ${format(key, before)} to ${format(key, after)}`
    + (percent === null ? '' : ` (${percent > 0 ? '+' : '−'}${Math.abs(percent)} %)`);
}
