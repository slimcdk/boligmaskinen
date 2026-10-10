import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { formatBytes } from '../jobs/data-pack.ts';
import type { JobContext, JobDefinition, JobOutcome } from '../jobs/types.ts';
import { Archive, type Archived, freshness, type SourceFile, USER_AGENT } from './archive.ts';
import { runStep, type StepOptions } from './python.ts';
import { Versions } from './versions.ts';

/** Where every source is fetched from (docs/data-sources.md); the tests point them at a server of their own. */
export const SOURCE_URLS = {
  osm: 'https://download.geofabrik.de/europe/denmark-latest.osm.pbf',
  zones: 'https://geoserver.plandata.dk/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=pdk:theme_pdk_zonekort_v&outputFormat=application/json&srsName=EPSG:25832&count=20000',
  institutions: 'https://institutionsregisteret.stil.dk/frontend-api/Institutions',
  daycare: 'https://dagtilbudsregister.stil.dk/Eksport.aspx',
  /** The page that links to the newest wind turbine data; the link changes with every upload. */
  turbinesPage: 'https://ens.dk/analyser-og-statistik/data-oversigt-over-energisektoren',
  statbank: 'https://api.statbank.dk/v1/data',
  noise: 'https://files-miljoegis.mim.dk/noise2022/2022_noise_shp.zip',
  naturalEarth: 'https://naciscdn.org/naturalearth/50m',
  /** DCE's air quality through Danmarks Miljøportal's WFS: 90,162 squares of 1 km per layer. */
  air: 'https://arld-extgeo.miljoeportal.dk/geoserver/wfs',
  /** Miljøstyrelsen's protected areas, Natura 2000 and the raw material areas, through Danmarks Miljøportal's Arealinformation WFS. */
  protected: 'https://arealeditering-dist-geo.miljoeportal.dk/geoserver/wfs',
  /** Plandata.dk's WFS, for the roads and railways the municipal plans plan. */
  plans: 'https://geoserver.plandata.dk/geoserver/wfs',
};

export type SourceUrls = typeof SOURCE_URLS;

const LICENCES = {
  osm: 'ODbL 1.0, © OpenStreetMap contributors',
  plandata: 'CC BY 4.0, Plan- og Landdistriktsstyrelsen (Plandata.dk)',
  stil: 'No licence stated; a public register of Styrelsen for It og Læring',
  ens: "Energistyrelsen's terms: free to use with the source named",
  dst: 'CC BY 4.0, Danmarks Statistik',
  noise: 'CC BY 4.0, Miljøstyrelsen',
  naturalEarth: 'Public domain, Natural Earth',
  air: 'CC BY 4.0, DCE – Nationalt Center for Miljø og Energi, Aarhus Universitet (Danmarks Miljøportal)',
  protected: 'CC0 1.0, Miljøstyrelsen and the regions (Danmarks Miljøportal)',
};

/** What the data jobs need to fetch and build. */
export interface PipelineOptions {
  /** Where the raw archive, the work files and the data packs live; without it the jobs cannot run. */
  dataDir: string | null;
  /** The Python that has the pipeline installed. */
  python: string;
  /** The app's revision: what an older version built from a source is built again. */
  revision: string;
  /** The instance's time zone, for the dates in the results. */
  timeZone?: string;
  urls?: Partial<SourceUrls>;
}

export const NEEDS_DATA_DIR = 'Set DATA_DIR to let the jobs fetch and build the data';

const number = (n: number) => n.toLocaleString('en-US');

/** What a run of a pipeline job works with. */
export interface Work {
  context: JobContext;
  archive: Archive;
  dataDir: string;
  urls: SourceUrls;
  revision: string;
  step(progress?: [number, number]): StepOptions;
  /** A time as the day it is in the instance's time zone: 2026-10-09. */
  day(iso: string): string;
}

export function work(context: JobContext, options: PipelineOptions & { dataDir: string }): Work {
  const days = new Intl.DateTimeFormat('en-CA', { timeZone: options.timeZone ?? 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' });
  return {
    context, dataDir: options.dataDir, revision: options.revision, archive: new Archive(context.db, options.dataDir),
    urls: { ...SOURCE_URLS, ...options.urls },
    step: (progress) => ({ python: options.python, tmpDir: join(options.dataDir, 'tmp'), progress }),
    day: (iso) => days.format(new Date(iso)),
  };
}

/** "Unchanged since 2026-10-09", the day the newest of the files was fetched. */
function unchangedSince(w: Work, files: SourceFile[]): string {
  return `Unchanged since ${w.day(files.map((f) => f.fetchedAt).sort().at(-1)!)}`;
}

/** A version id that sorts in the order they were made: 20261009T034000Z-run42. */
export function versionId(context: JobContext): string {
  return `${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}-run${context.runId}`;
}

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** What a build was made from, kept next to it as made-from.json, so an unchanged source is not built again. */
export interface MadeFrom {
  revision: string;
  inputs: Record<string, string>;
}

async function madeFrom(dir: string | null): Promise<MadeFrom | null> {
  return dir ? readJson<MadeFrom>(join(dir, 'made-from.json')) : null;
}

export function sameInputs(a: MadeFrom | null, b: MadeFrom): boolean {
  return !!a && a.revision === b.revision && JSON.stringify(a.inputs) === JSON.stringify(b.inputs);
}

const zipCheck = (content: Buffer) => {
  if (content.subarray(0, 4).toString('latin1') !== 'PK\u0003\u0004') throw new Error('not a ZIP file');
  return formatBytes(content.length);
};

function jsonCheck(describe: (json: unknown) => string) {
  return (content: Buffer) => {
    let json: unknown;
    try {
      json = JSON.parse(content.toString('utf8'));
    } catch {
      throw new Error(`not JSON: ${content.subarray(0, 80).toString('utf8')}…`);
    }
    return describe(json);
  };
}

// --- The sources ---------------------------------------------------------------------------------

/** OpenStreetMap: the Geofabrik extract of Denmark, and the layers and addresses taken from it. */
async function fetchOsm(w: Work): Promise<JobOutcome> {
  const pbf = await w.archive.download(w.context, { source: 'osm', name: 'denmark-latest.osm.pbf', url: w.urls.osm, licence: LICENCES.osm, progress: [0, 0.5] });
  await w.context.log(`The extract of Denmark: ${freshness(pbf, w.day)}`);
  const extracts = new Versions(join(w.dataDir, 'work', 'osm'));
  const wanted: MadeFrom = { revision: w.revision, inputs: { pbf: pbf.file.sha256 } };
  if (sameInputs(await madeFrom(await extracts.current()), wanted)) {
    return { changed: false, result: unchangedSince(w, [pbf.file]), bytes: pbf.file.bytes };
  }
  const id = versionId(w.context);
  const stage = await extracts.staging(id);
  await runStep(w.context, w.step([0.5, 1]), 'osm', [pbf.file.path, stage]);
  await writeFile(join(stage, 'made-from.json'), JSON.stringify(wanted));
  const dir = await extracts.publish(stage, id);
  const counts = (await readJson<Record<string, number>>(join(dir, 'counts.json'))) ?? {};
  return { changed: true, result: `${number(counts['addresses'] ?? 0)} addresses, ${number(counts['road'] ?? 0)} roads, ${number(counts['forest'] ?? 0)} forests`, bytes: pbf.file.bytes };
}

async function fetchZones(w: Work): Promise<JobOutcome> {
  const zones = await w.archive.download(w.context, {
    source: 'plandata', name: 'zonekort.geojson', url: w.urls.zones, licence: LICENCES.plandata, progress: [0, 0.9],
    // GeoServer stamps every answer with the time it was made
    normalize: (content) => {
      const { timeStamp: _, ...rest } = JSON.parse(content.toString('utf8')) as Record<string, unknown>;
      return JSON.stringify(rest);
    },
    check: jsonCheck((json) => {
      const features = (json as { features?: unknown[] }).features;
      if (!Array.isArray(features) || features.length === 0) throw new Error('a GeoJSON file without features');
      return `${number(features.length)} polygons`;
    }),
  });
  return outcome(w, zones);
}

async function fetchSchools(w: Work): Promise<JobOutcome> {
  const institutions = await w.archive.download(w.context, {
    source: 'stil-schools', name: 'institutions.json', url: w.urls.institutions, licence: LICENCES.stil, headers: { accept: 'application/json' },
    check: jsonCheck((json) => {
      if (!Array.isArray(json) || json.length === 0) throw new Error('not a list of institutions');
      const schools = (json as { institutionTypeId?: number; activeCodeName?: string }[])
        .filter((i) => (i.institutionTypeId === 1012 || i.institutionTypeId === 1013) && (i.activeCodeName ?? '').startsWith('Aktiv'));
      return `${number(schools.length)} active schools among ${number(json.length)} institutions`;
    }),
  });
  return outcome(w, institutions);
}

/** The register's own CSV export, behind a form that wants the page's state posted back. */
async function fetchDaycare(w: Work): Promise<JobOutcome> {
  const page = await fetch(w.urls.daycare, { headers: { 'user-agent': USER_AGENT }, signal: w.context.signal });
  if (!page.ok) throw new Error(`${w.urls.daycare} answered ${page.status}`);
  const html = await page.text();
  const form = new URLSearchParams({ __EVENTTARGET: 'ctl00$ContentPlaceHolder1$LinkButtonAnv', __EVENTARGUMENT: '' });
  for (const field of ['__VIEWSTATE', '__VIEWSTATEGENERATOR', '__EVENTVALIDATION']) {
    const value = new RegExp(`id="${field}" value="([^"]*)"`).exec(html)?.[1];
    if (value === undefined) throw new Error(`The export page has no ${field}; it may have changed`);
    form.set(field, value);
  }
  const cookie = page.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const daycare = await w.archive.download(w.context, {
    source: 'stil-daycare', name: 'dagtilbud.csv', url: w.urls.daycare, licence: LICENCES.stil, method: 'POST', body: form.toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) },
    check: (content) => {
      const lines = content.toString('utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
      const header = lines[0]?.split(';') ?? [];
      const status = header.indexOf('aktivitetsstatus');
      if (status < 0 || !header.includes('geoBredde') || !header.includes('geoLaengde')) throw new Error('a CSV file without the columns of the export');
      const active = lines.slice(1).filter((l) => l.split(';')[status] === 'Aktiv').length;
      return `${number(active)} active units`;
    },
  });
  return outcome(w, daycare);
}

/** Energistyrelsen's wind turbine data: its link changes with every monthly upload, so it is found on the data page. */
async function fetchTurbines(w: Work): Promise<JobOutcome> {
  const page = await fetch(w.urls.turbinesPage, { headers: { 'user-agent': USER_AGENT }, signal: w.context.signal });
  if (!page.ok) throw new Error(`${w.urls.turbinesPage} answered ${page.status}`);
  const match = /<a[^>]*href="([^"]*\/media\/\d+\/download)"[^>]*>\s*(Vinddata\b[^<]*)/.exec(await page.text());
  if (!match) throw new Error(`Found no link to "Vinddata" on ${w.urls.turbinesPage}; the page may have changed`);
  const label = match[2].trim().replace(/\s+/g, ' ');
  await w.context.log(`The newest upload: ${label}`);
  const turbines = await w.archive.download(w.context, {
    source: 'ens', name: 'vinddata.xlsx', url: new URL(match[1], w.urls.turbinesPage).href, licence: LICENCES.ens, check: zipCheck,
  });
  return { ...outcome(w, turbines), result: turbines.changed ? label : unchangedSince(w, [turbines.file]) };
}

/** Danmarks Statistik's tables per municipality, each in its newest period. */
/** The tables, and the periods each takes: the newest, "(1)", unless a table lists one before it has its numbers. */
const STATBANK_TABLES: { name: string; table: string; variables: Record<string, string[]>; periods?: string[] }[] = [
  { name: 'pskat.json', table: 'PSKAT', variables: { SKATPCT: ['KOM', 'GRUND'] } },
  { name: 'straf.json', table: 'STRAF22', variables: { 'OVERTRÆD': ['1320'], ANMSIGT: ['ANM'] } },
  { name: 'folk.json', table: 'FOLK1A', variables: { 'KØN': ['TOT'], ALDER: ['IALT'], CIVILSTAND: ['TOT'] } },
  // The mean disposable income of all residents. Its newest year comes with zeros before the
  // numbers, so the two newest come along, and the grid takes the newest with numbers
  { name: 'indkomst.json', table: 'INDKP101', variables: { ENHED: ['116'], KOEN: ['MOK'], INDKOMSTTYPE: ['100'] }, periods: ['(1)', '(2)'] },
  // The yearly rate of a municipal nursery place (0-2 years), and the pupils per class in the folkeskole
  { name: 'res88.json', table: 'RES88', variables: { INSTITUTION: ['F03'] }, periods: ['(1)', '(2)'] },
  { name: 'kvotien.json', table: 'KVOTIEN', variables: { KLASSE: ['0000'], SKTPE: ['ANTAL1012'] }, periods: ['(1)', '(2)'] },
];

async function fetchStatistics(w: Work): Promise<JobOutcome> {
  const fetched: Archived[] = [];
  for (const [i, { name, table, variables, periods = ['(1)'] }] of STATBANK_TABLES.entries()) {
    const body = {
      table, format: 'JSONSTAT', lang: 'da',
      // "*" is every area: the country, the regions and the municipalities; "(1)" the newest period
      variables: [{ code: 'OMRÅDE', values: ['*'] }, ...Object.entries(variables).map(([code, values]) => ({ code, values })), { code: 'Tid', values: periods }],
    };
    fetched.push(await w.archive.download(w.context, {
      source: 'dst', name, url: w.urls.statbank, licence: LICENCES.dst, method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
      check: jsonCheck((json) => {
        const dataset = (json as { dataset?: { value?: unknown[]; dimension?: { Tid?: { category?: { index?: Record<string, number> } } } } }).dataset;
        if (!dataset?.value?.length) throw new Error(`no values in ${table}`);
        return `${table} ${Object.keys(dataset.dimension?.Tid?.category?.index ?? {}).join(', ')}`;
      }),
    }));
    await w.context.progress((i + 1) / STATBANK_TABLES.length);
  }
  for (const f of fetched) await w.context.log(`${f.summary}: ${freshness(f, w.day)}`);
  const changed = fetched.some((f) => f.changed);
  return {
    changed, bytes: fetched.reduce((sum, f) => sum + f.file.bytes, 0),
    result: changed ? fetched.map((f) => f.summary).join(', ') : unchangedSince(w, fetched.map((f) => f.file)),
  };
}

/** Miljøstyrelsen's strategic noise maps the grid reads: roads, railways, airports and industry. */
export const NOISE_MAPS = ['eu_2022_vej_4m', 'eu_2022_jernbane_4m', 'eu_2022_lufthavn_4m', 'eu_2022_virksomhed_by_4m'];
/** Their files, the roads' shapefile first. */
export const NOISE_FILES = NOISE_MAPS.flatMap((map) => ['shp', 'shx', 'dbf', 'prj'].map((ext) => `${map}.${ext}`));

async function fetchNoise(w: Work): Promise<JobOutcome> {
  const head = await fetch(w.urls.noise, { method: 'HEAD', headers: { 'user-agent': USER_AGENT }, signal: w.context.signal });
  if (!head.ok) throw new Error(`${w.urls.noise} answered ${head.status}`);
  const validators = { etag: head.headers.get('etag'), lastModified: head.headers.get('last-modified') };
  const current = await w.archive.current('noise');
  const kept = NOISE_FILES.map((name) => current.get(name) ?? null);
  const unchanged = (validators.etag || validators.lastModified)
    && kept.every((f) => f && f.etag === validators.etag && f.lastModified === validators.lastModified);
  if (unchanged && (await Promise.all(kept.map((f) => w.archive.present(f)))).every(Boolean)) {
    for (const f of kept) await w.archive.touch(f!, {});
    return { changed: false, result: unchangedSince(w, kept as SourceFile[]), bytes: kept.reduce((sum, f) => sum + f!.bytes, 0) };
  }
  await w.context.log(`The archive is ${formatBytes(Number(head.headers.get('content-length')) || 0)}; taking out the noise maps of roads, railways, airports and industry`);
  const tmp = await w.archive.tmpPath('-noise');
  await mkdir(tmp);
  try {
    const pattern = `^(.*/)?(${NOISE_MAPS.join('|')})\\.(shp|shx|dbf|prj)$`;
    await runStep(w.context, w.step([0, 0.9]), 'remote-zip', ['extract', w.urls.noise, pattern, tmp]);
    const files = await w.archive.keepFiles(w.context, NOISE_FILES.map((name) => ({
      spec: { source: 'noise', name, url: w.urls.noise, licence: LICENCES.noise }, tmp: join(tmp, name), known: validators,
    })));
    const bytes = files.reduce((sum, f) => sum + f.file.bytes, 0);
    const changed = files.some((f) => f.changed);
    return { changed, bytes, result: changed ? `The noise maps, ${formatBytes(bytes)}` : unchangedSince(w, files.map((f) => f.file)) };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

/** DCE's model of the air: yearly means of NO₂ and PM2.5 on a 1 km grid. */
export const AIR_LAYERS = [
  { name: 'no2.geojson', layer: 'luft:ID6_Luft_Koncentration_2024_NO2', property: 'NO2' },
  { name: 'pm25.geojson', layer: 'luft:ID7_Luft_Koncentration_2024_PM2_5', property: 'PM2_5' },
];

/** A layer of a GeoServer WFS, the file it is kept as, and what its features have to be. */
interface WfsLayer {
  name: string;
  layer: string;
  /** Only the features that match, in GeoServer's CQL, e.g. datovedt>=20241010. */
  filter?: string;
  /** Says what the features are, or throws when they are not what the layer has. */
  check: (features: { geometry?: unknown; properties?: Record<string, unknown> }[]) => string;
}

/**
 * Layers of a GeoServer WFS as GeoJSON in EPSG:25832, one GetFeature each. GeoServer stamps every
 * answer with the time it was made, which the change check leaves out.
 */
async function fetchWfs(w: Work, source: string, base: string, licence: string, layers: WfsLayer[], count: number): Promise<JobOutcome> {
  const fetched: Archived[] = [];
  for (const [i, { name, layer, filter, check }] of layers.entries()) {
    const url = `${base}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${layer}&outputFormat=application/json&srsName=EPSG:25832&count=${count}`
      + (filter ? `&CQL_FILTER=${encodeURIComponent(filter)}` : '');
    fetched.push(await w.archive.download(w.context, {
      source, name, url, licence, progress: [i / layers.length, (i + 1) / layers.length],
      normalize: (content) => {
        const { timeStamp: _, ...rest } = JSON.parse(content.toString('utf8')) as Record<string, unknown>;
        return JSON.stringify(rest);
      },
      check: jsonCheck((json) => {
        const features = (json as { features?: unknown }).features;
        if (!Array.isArray(features)) throw new Error('a GeoJSON file without features');
        return check(features);
      }),
    }));
  }
  for (const f of fetched) await w.context.log(`${f.summary}: ${freshness(f, w.day)}`);
  const changed = fetched.some((f) => f.changed);
  return {
    changed, bytes: fetched.reduce((sum, f) => sum + f.file.bytes, 0),
    result: changed ? fetched.map((f) => f.summary).join(', ') : unchangedSince(w, fetched.map((f) => f.file)),
  };
}

/** A check that there are at least `minimum` features, with areas. */
const areas = (what: string, minimum: number): WfsLayer['check'] => (features) => {
  if (features.length < minimum) throw new Error(`only ${features.length} ${what}`);
  if (features.length && !features[0].geometry) throw new Error(`${what} without their areas`);
  return `${number(features.length)} ${what}`;
};

const fetchAir = (w: Work) => fetchWfs(w, 'air', w.urls.air, LICENCES.air, AIR_LAYERS.map(({ name, layer, property }) => ({
  name, layer, check: (features) => {
    if (features.length < 1000) throw new Error(`only ${features.length} squares`);
    if (typeof features[0].properties?.[property] !== 'number') throw new Error(`squares without ${property}`);
    return `${number(features.length)} squares of ${property.replace('_', '.')}`;
  },
})), 200_000);

/**
 * Miljøstyrelsen's protected areas (fredninger), the Natura 2000 areas for habitats and birds, and
 * the regions' raw material areas: for digging now, or kept for later.
 */
const PROTECTED_LAYERS: WfsLayer[] = [
  { name: 'fredede_omr.geojson', layer: 'dai:fredede_omr', check: areas('protected areas', 1000) },
  { name: 'habitat_omr.geojson', layer: 'dai:habitat_omr', check: areas('habitat areas', 100) },
  { name: 'fugle_bes_omr.geojson', layer: 'dai:fugle_bes_omr', check: areas('bird protection areas', 50) },
  { name: 'raastofomr.geojson', layer: 'dai:raastofomr', check: areas('raw material areas', 500) },
];

const fetchProtected = (w: Work) => fetchWfs(w, 'protected', w.urls.protected, LICENCES.protected, PROTECTED_LAYERS, 100_000);

/**
 * The traffic the municipal plans plan, adopted and proposed: roads and railways, and also paths,
 * stations, parking, ports and airports, which the grid leaves out. Proposals may be few.
 */
const PLANNED_LAYERS: WfsLayer[] = [
  { name: 'planlagttrafikanlaeg_vedtaget.geojson', layer: 'pdk:theme_pdk_planlagttrafikanlaeg_vedtaget', check: areas('adopted', 500) },
  { name: 'planlagttrafikanlaeg_forslag.geojson', layer: 'pdk:theme_pdk_planlagttrafikanlaeg_forslag', check: areas('proposed', 0) },
];

/** The zones the plans draw around businesses and technical plants that smell, make noise or are a risk. */
const CONSEQUENCE_ZONES: WfsLayer[] = [
  { name: 'konsekvensomraade_vedtaget.geojson', layer: 'pdk:theme_pdk_konsekvensomraade_vedtaget', check: areas('zones around businesses', 100) },
  { name: 'tekniskanlaegkonsekvensomraade_vedtaget.geojson', layer: 'pdk:theme_pdk_tekniskanlaegkonsekvensomraade_vedtaget', check: areas('zones around plants', 100) },
];

/** The heat plans' supply areas: district heating, or individual natural gas, among others. */
const SUPPLY_AREAS: WfsLayer = { name: 'forsyningomraade_vedtaget.geojson', layer: 'pdk:theme_pdk_forsyningomraade_vedtaget_v', check: areas('supply areas', 1000) };

/** The local plans of the last two years, proposed or adopted: building to come, or change. */
function localPlanLayers(since: string): WfsLayer[] {
  return [
    { name: 'lokalplan_forslag.geojson', layer: 'pdk:theme_pdk_lokalplan_forslag', filter: `datoforsl>=${since}`, check: areas('proposed local plans', 0) },
    { name: 'lokalplan_vedtaget.geojson', layer: 'pdk:theme_pdk_lokalplan_vedtaget', filter: `datovedt>=${since}`, check: areas('adopted local plans', 100) },
  ];
}

function fetchPlans(w: Work): Promise<JobOutcome> {
  // Two years back, as Plandata writes a date: 20241010
  const since = w.day(new Date(Date.now() - 730 * 86_400_000).toISOString()).replaceAll('-', '');
  return fetchWfs(w, 'plans', w.urls.plans, LICENCES.plandata, [...PLANNED_LAYERS, ...localPlanLayers(since), SUPPLY_AREAS, ...CONSEQUENCE_ZONES], 20_000);
}

/** Natural Earth's world map, and the layers built from it. */
export const NATURAL_EARTH = [
  'physical/ne_50m_land', 'physical/ne_50m_lakes', 'cultural/ne_50m_admin_0_boundary_lines_land',
  'cultural/ne_50m_admin_0_countries', 'cultural/ne_50m_populated_places_simple',
];

async function fetchWorld(w: Work): Promise<JobOutcome> {
  const zips: Archived[] = [];
  for (const [i, path] of NATURAL_EARTH.entries()) {
    const name = `${path.split('/')[1]}.zip`;
    zips.push(await w.archive.download(w.context, { source: 'world', name, url: `${w.urls.naturalEarth}/${path}.zip`, licence: LICENCES.naturalEarth, check: zipCheck }));
    await w.context.progress((0.5 * (i + 1)) / NATURAL_EARTH.length);
  }
  const bytes = zips.reduce((sum, z) => sum + z.file.bytes, 0);
  const builds = new Versions(join(w.dataDir, 'work', 'world'));
  const wanted: MadeFrom = { revision: w.revision, inputs: Object.fromEntries(zips.map((z) => [z.file.name, z.file.sha256])) };
  if (sameInputs(await madeFrom(await builds.current()), wanted)) {
    return { changed: false, result: unchangedSince(w, zips.map((z) => z.file)), bytes };
  }
  const id = versionId(w.context);
  const stage = await builds.staging(id);
  await runStep(w.context, w.step([0.5, 1]), 'world', [stage, ...zips.map((z) => z.file.path)]);
  await writeFile(join(stage, 'made-from.json'), JSON.stringify(wanted));
  await builds.publish(stage, id);
  return { changed: true, result: '5 layers: land, lakes, borders, countries and places', bytes };
}

function outcome(w: Work, archived: Archived): JobOutcome {
  return {
    changed: archived.changed, bytes: archived.file.bytes,
    result: archived.changed ? archived.summary ?? formatBytes(archived.file.bytes) : unchangedSince(w, [archived.file]),
  };
}

// --- The jobs -------------------------------------------------------------------------------------

type SourceJob = Omit<JobDefinition, 'run' | 'kind' | 'enabledByDefault'> & { fetch: (w: Work) => Promise<JobOutcome> };

const SOURCES: SourceJob[] = [
  {
    id: 'osm', name: 'OpenStreetMap', source: 'Geofabrik', schedule: '0 3 * * *', then: ['grid', 'roads'], fetch: fetchOsm,
    description: 'The extract of Denmark, and from it forests, water, beaches, shops, stations, roads, addresses and municipalities.',
  },
  { id: 'plandata', name: 'Planning zones', source: 'Plandata.dk', schedule: '30 3 * * *', then: ['grid'], fetch: fetchZones, description: 'Byzone and sommerhusområde polygons from the WFS.' },
  { id: 'stil-schools', name: 'Schools', source: 'STIL Institutionsregisteret', schedule: '40 3 * * *', then: ['grid'], fetch: fetchSchools, description: 'Folkeskoler, friskoler and private schools.' },
  { id: 'stil-daycare', name: 'Daycare', source: 'STIL Dagtilbudsregisteret', schedule: '45 3 * * *', then: ['grid'], fetch: fetchDaycare, description: 'The register’s CSV export of active units.' },
  {
    id: 'ens', name: 'Wind turbines', source: 'Energistyrelsen', schedule: '0 4 2 * *', then: ['grid'], fetch: fetchTurbines,
    description: 'The monthly master data register; the job finds the newest upload on the data overview page.',
  },
  { id: 'dst', name: 'Municipal statistics', source: 'Danmarks Statistik', schedule: '0 5 * * 1', then: ['grid'], fetch: fetchStatistics, description: 'Tax (PSKAT), population (FOLK1A), burglaries (STRAF22), income (INDKP101), nursery rates (RES88) and class sizes (KVOTIEN), each in its newest period.' },
  {
    id: 'noise', name: 'Noise', source: 'Miljøstyrelsen', schedule: '0 4 1 * *', then: ['grid'], fetch: fetchNoise,
    description: 'The strategic noise maps of roads, railways, airports and industry, taken out of the 2 GB archive with range requests. New maps every 5 years.',
  },
  {
    id: 'air', name: 'Air quality', source: 'DCE, Danmarks Miljøportal', schedule: '0 5 2 * *', then: ['grid'], fetch: fetchAir,
    description: 'Nitrogen dioxide and fine particles: yearly means on a 1 km grid from DCE’s model.',
  },
  {
    id: 'plans', name: 'Plans', source: 'Plandata.dk', schedule: '35 3 * * *', then: ['grid'], fetch: fetchPlans,
    description: 'The roads and railways the municipal plans lay out, the local plans of the last two years, adopted or proposed, the heat plans’ supply areas, and the zones around businesses and plants, from the WFS.',
  },
  {
    id: 'protected', name: 'Protected areas', source: 'Miljøstyrelsen, Danmarks Miljøportal', schedule: '0 5 3 * *', then: ['grid'], fetch: fetchProtected,
    description: 'Fredninger, the Natura 2000 areas for habitats and birds, and the regions’ raw material areas, from Danmarks Miljøportal’s WFS.',
  },
  { id: 'world', name: 'World map', source: 'Natural Earth', schedule: '0 2 1 * *', then: ['pack'], fetch: fetchWorld, description: 'Land, lakes, borders and names outside Denmark.' },
];

/** The fetch jobs' names, by their ids. */
export const FETCH_JOBS: Record<string, string> = Object.fromEntries(SOURCES.map((s) => [s.id, s.name]));

/** A job per source. Each fetches into the raw archive and starts the build when something changed. */
export function sourceJobs(options: PipelineOptions): JobDefinition[] {
  return SOURCES.map(({ fetch, ...job }) => {
    const dataDir = options.dataDir;
    if (!dataDir) return { ...job, kind: 'fetch', enabledByDefault: true, blocked: NEEDS_DATA_DIR };
    return { ...job, kind: 'fetch', enabledByDefault: true, run: (context) => fetch(work(context, { ...options, dataDir })) };
  });
}
