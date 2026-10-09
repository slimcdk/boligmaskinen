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
const STATBANK_TABLES: { name: string; table: string; variables: Record<string, string[]> }[] = [
  { name: 'pskat.json', table: 'PSKAT', variables: { SKATPCT: ['KOM', 'GRUND'] } },
  { name: 'straf.json', table: 'STRAF22', variables: { 'OVERTRÆD': ['1320'], ANMSIGT: ['ANM'] } },
  { name: 'folk.json', table: 'FOLK1A', variables: { 'KØN': ['TOT'], ALDER: ['IALT'], CIVILSTAND: ['TOT'] } },
];

async function fetchStatistics(w: Work): Promise<JobOutcome> {
  const fetched: Archived[] = [];
  for (const [i, { name, table, variables }] of STATBANK_TABLES.entries()) {
    const body = {
      table, format: 'JSONSTAT', lang: 'da',
      // "*" is every area: the country, the regions and the municipalities; "(1)" the newest period
      variables: [{ code: 'OMRÅDE', values: ['*'] }, ...Object.entries(variables).map(([code, values]) => ({ code, values })), { code: 'Tid', values: ['(1)'] }],
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

/** The road noise map's files (a shapefile), taken out of Miljøstyrelsen's 2 GB archive with range requests. */
export const NOISE_FILES = ['eu_2022_vej_4m.shp', 'eu_2022_vej_4m.shx', 'eu_2022_vej_4m.dbf', 'eu_2022_vej_4m.prj'];

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
  await w.context.log(`The archive is ${formatBytes(Number(head.headers.get('content-length')) || 0)}; taking out the road noise map`);
  const tmp = await w.archive.tmpPath('-noise');
  await mkdir(tmp);
  try {
    const pattern = `^(.*/)?eu_2022_vej_4m\\.(shp|shx|dbf|prj)$`;
    await runStep(w.context, w.step([0, 0.9]), 'remote-zip', ['extract', w.urls.noise, pattern, tmp]);
    const files = await w.archive.keepFiles(w.context, NOISE_FILES.map((name) => ({
      spec: { source: 'noise', name, url: w.urls.noise, licence: LICENCES.noise }, tmp: join(tmp, name), known: validators,
    })));
    const bytes = files.reduce((sum, f) => sum + f.file.bytes, 0);
    const changed = files.some((f) => f.changed);
    return { changed, bytes, result: changed ? `The road noise map, ${formatBytes(bytes)}` : unchangedSince(w, files.map((f) => f.file)) };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
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
    id: 'osm', name: 'OpenStreetMap', source: 'Geofabrik', schedule: '0 3 * * *', then: ['grid'], fetch: fetchOsm,
    description: 'The extract of Denmark, and from it forests, water, beaches, shops, stations, roads, addresses and municipalities.',
  },
  { id: 'plandata', name: 'Planning zones', source: 'Plandata.dk', schedule: '30 3 * * *', then: ['grid'], fetch: fetchZones, description: 'Byzone and sommerhusområde polygons from the WFS.' },
  { id: 'stil-schools', name: 'Schools', source: 'STIL Institutionsregisteret', schedule: '40 3 * * *', then: ['grid'], fetch: fetchSchools, description: 'Folkeskoler, friskoler and private schools.' },
  { id: 'stil-daycare', name: 'Daycare', source: 'STIL Dagtilbudsregisteret', schedule: '45 3 * * *', then: ['grid'], fetch: fetchDaycare, description: 'The register’s CSV export of active units.' },
  {
    id: 'ens', name: 'Wind turbines', source: 'Energistyrelsen', schedule: '0 4 2 * *', then: ['grid'], fetch: fetchTurbines,
    description: 'The monthly master data register; the job finds the newest upload on the data overview page.',
  },
  { id: 'dst', name: 'Municipal statistics', source: 'Danmarks Statistik', schedule: '0 5 * * 1', then: ['grid'], fetch: fetchStatistics, description: 'Tax (PSKAT), population (FOLK1A) and burglaries (STRAF22), each in its newest period.' },
  {
    id: 'noise', name: 'Road noise', source: 'Miljøstyrelsen', schedule: '0 4 1 * *', then: ['grid'], fetch: fetchNoise,
    description: 'The strategic noise map of roads, taken out of the 2 GB archive with range requests. New maps every 5 years.',
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
