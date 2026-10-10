import { createHash } from 'node:crypto';
import { copyFile, link, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { REGIONS, type GridSettings } from '../config.ts';
import { formatBytes } from '../jobs/data-pack.ts';
import type { JobContext, JobDefinition, JobOutcome } from '../jobs/types.ts';
import { USER_AGENT } from './archive.ts';
import { describeChange, largeChanges, type PackFacts } from './checks.ts';
import { runProgram, runStep } from './python.ts';
import { FETCH_JOBS, type MadeFrom, NEEDS_DATA_DIR, NOISE_FILES, type PipelineOptions, readJson, sameInputs, versionId, type Work, work } from './sources.ts';
import { FONTS, GLYPH_RANGES, styleLayers } from './styles.ts';
import { Versions } from './versions.ts';

/** Where Protomaps publishes its daily planet builds, and the fonts and sprites of its styles. */
export const PROTOMAPS_URLS = {
  builds: 'https://build-metadata.protomaps.dev/builds.json',
  tiles: 'https://build.protomaps.com',
  assets: 'https://protomaps.github.io/basemaps-assets',
  /** The sprites are made from tangrams' icons, under MIT. */
  iconsLicence: 'https://raw.githubusercontent.com/tangrams/icons/master/LICENSE.md',
};

/** Denmark up to zoom 12 is about 75 MB; zoom 13 doubles it. */
const BASEMAP_MAX_ZOOM = 12;
const SPRITES = ['light', 'dark'].flatMap((flavour) => [`${flavour}.json`, `${flavour}.png`, `${flavour}@2x.json`, `${flavour}@2x.png`]);

/** What the build jobs need besides the fetch jobs' options. */
export interface BuildOptions extends PipelineOptions {
  /** The link the app serves the data pack through. */
  dataPackDir: string | null;
  grid: GridSettings;
  pmtiles: string;
  protomaps?: Partial<typeof PROTOMAPS_URLS>;
}

const number = (n: number) => n.toLocaleString('en-US');
const count = (n: number, word: string) => `${number(n)} ${word}${n === 1 ? '' : 's'}`;
const sha256 = (content: string | Buffer) => createHash('sha256').update(content).digest('hex');
const exists = (path: string) => stat(path).then(() => true, () => false);

/** "Noise and Wind turbines". */
function names(jobIds: string[]): string {
  const named = jobIds.map((id) => FETCH_JOBS[id] ?? BUILD_NAMES[id] ?? id);
  return named.length > 1 ? `${named.slice(0, -1).join(', ')} and ${named.at(-1)}` : named[0];
}

const BUILD_NAMES: Record<string, string> = { grid: 'Build the grid', basemap: 'Basemap', world: 'World map', pack: 'Pack the data', roads: 'Road network' };

/** A result that says the job waits, and starts nothing after it. */
function waiting(text: string): JobOutcome {
  return { changed: false, result: text };
}

/** A file in the new version's folder, linked to the one in the archive when they are on the same disk. */
async function place(from: string, to: string): Promise<void> {
  await mkdir(dirname(to), { recursive: true });
  await link(from, to).catch(() => copyFile(from, to));
}

// --- Build the grid --------------------------------------------------------------------------------

/** The files the grid step reads, by the name inputs.json gives them, and where the raw archive has them. */
const GRID_SOURCES: Record<string, [job: string, name: string]> = {
  noise: ['noise', NOISE_FILES[0]],
  zones: ['plandata', 'zonekort.geojson'],
  institutions: ['stil-schools', 'institutions.json'],
  daycare: ['stil-daycare', 'dagtilbud.csv'],
  turbines: ['ens', 'vinddata.xlsx'],
  tax: ['dst', 'pskat.json'],
  burglaries: ['dst', 'straf.json'],
  population: ['dst', 'folk.json'],
  no2: ['air', 'no2.geojson'],
  pm25: ['air', 'pm25.geojson'],
  protected_areas: ['protected', 'fredede_omr.geojson'],
  natura2000_habitats: ['protected', 'habitat_omr.geojson'],
  natura2000_birds: ['protected', 'fugle_bes_omr.geojson'],
  planned_traffic: ['plans', 'planlagttrafikanlaeg_vedtaget.geojson'],
  planned_traffic_proposed: ['plans', 'planlagttrafikanlaeg_forslag.geojson'],
  local_plans_proposed: ['plans', 'lokalplan_forslag.geojson'],
  local_plans_adopted: ['plans', 'lokalplan_vedtaget.geojson'],
  supply_areas: ['plans', 'forsyningomraade_vedtaget.geojson'],
  consequence_zones: ['plans', 'konsekvensomraade_vedtaget.geojson'],
  consequence_zones_plants: ['plans', 'tekniskanlaegkonsekvensomraade_vedtaget.geojson'],
};
/** Files the grid reads when they are there: an install fetched the noise archive before it took these out too. */
const OPTIONAL_GRID_SOURCES: Record<string, [job: string, name: string]> = {
  // An install fetched the statistics before the income came; it comes with their next run
  income: ['dst', 'indkomst.json'],
  noise_rail: ['noise', 'eu_2022_jernbane_4m.shp'],
  noise_air: ['noise', 'eu_2022_lufthavn_4m.shp'],
  noise_industry: ['noise', 'eu_2022_virksomhed_by_4m.shp'],
};

interface GridMeta {
  region: { name: string };
  width: number;
  height: number;
  cellMetres: number;
  gridMetres?: number;
  counts: Record<string, number>;
}

async function buildGrid(w: Work, settings: GridSettings): Promise<JobOutcome> {
  // A fetch that runs now starts the grid when it is done, so this one leaves it to that
  const busy = await w.context.busy(Object.keys(FETCH_JOBS).filter((id) => id !== 'world'));
  if (busy.length) return waiting(`Waiting for ${names(busy)}, which ${busy.length > 1 ? 'fetch' : 'fetches'} now`);

  const osm = await new Versions(join(w.dataDir, 'work', 'osm')).current();
  const files: Record<string, string> = {};
  const hashes: Record<string, string> = {};
  const missing = new Set<string>(osm ? [] : ['osm']);
  if (osm) {
    files['osm_layers'] = join(osm, 'layers.gpkg');
    files['osm_addresses'] = join(osm, 'addresses.npy');
    hashes['osm'] = (await readJson<MadeFrom>(join(osm, 'made-from.json')))?.inputs['pbf'] ?? osm;
  }
  for (const [key, [job, name]] of Object.entries(GRID_SOURCES)) {
    const file = await w.archive.newest(job, name);
    if (!file || !(await w.archive.present(file))) {
      missing.add(job);
      continue;
    }
    files[key] = file.path;
    hashes[key] = file.sha256;
  }
  if (missing.size) return waiting(`Waiting for ${names([...missing])}: nothing fetched yet`);
  for (const [key, [job, name]] of Object.entries(OPTIONAL_GRID_SOURCES)) {
    const file = await w.archive.newest(job, name);
    if (!file || !(await w.archive.present(file))) continue;
    files[key] = file.path;
    hashes[key] = file.sha256;
  }

  const grids = new Versions(join(w.dataDir, 'work', 'grid'));
  const wanted: MadeFrom = { revision: w.revision, inputs: { ...hashes, cellMetres: String(settings.cellMetres), region: settings.region } };
  if (sameInputs(await readJson<MadeFrom>(join((await grids.current()) ?? '', 'made-from.json')), wanted)) {
    return waiting('Nothing changed since the last build');
  }
  const id = versionId(w.context);
  const stage = await grids.staging(id);
  await writeFile(join(stage, 'inputs.json'), JSON.stringify(files, null, 1));
  await runStep(w.context, w.step(), 'grid', [join(stage, 'inputs.json'), stage, '--region', settings.region, '--cell', String(settings.cellMetres)]);
  await writeFile(join(stage, 'made-from.json'), JSON.stringify(wanted));
  const dir = await grids.publish(stage, id);
  const meta = (await readJson<GridMeta>(join(dir, 'meta.json')))!;
  return {
    changed: true,
    result: `${meta.region.name}: ${meta.width} × ${meta.height} cells of ${meta.cellMetres} m, ${number(meta.counts['homeCells'] ?? 0)} with homes`,
  };
}

// --- The road network ----------------------------------------------------------------------------

/** The road network that travel times are found on: built from the OSM extract the archive has. */
async function buildRoads(w: Work): Promise<JobOutcome> {
  const pbf = await w.archive.newest('osm', 'denmark-latest.osm.pbf');
  if (!pbf || !(await w.archive.present(pbf))) return waiting('Waiting for OpenStreetMap: nothing fetched yet');
  const networks = roadVersions(w.dataDir);
  const wanted: MadeFrom = { revision: w.revision, inputs: { pbf: pbf.sha256 } };
  if (sameInputs(await readJson<MadeFrom>(join((await networks.current()) ?? '', 'made-from.json')), wanted)) {
    return waiting('Nothing changed since the last build');
  }
  const id = versionId(w.context);
  const stage = await networks.staging(id);
  await runStep(w.context, w.step(), 'roads', [pbf.path, stage]);
  await writeFile(join(stage, 'made-from.json'), JSON.stringify(wanted));
  const dir = await networks.publish(stage, id);
  const counts = (await readJson<Record<string, number>>(join(dir, 'counts.json'))) ?? {};
  return {
    changed: true,
    result: `${count(counts['nodes'] ?? 0, 'node')}: ${number(counts['carEdges'] ?? 0)} edges by car, ${number(counts['bikeEdges'] ?? 0)} by bike, ${number(counts['walkEdges'] ?? 0)} on foot`,
  };
}

/** The versions of the road network: the newest two, as each is about 400 MB for Denmark. */
export const roadVersions = (dataDir: string) => new Versions(join(dataDir, 'work', 'roads'), { keep: 2 });

// --- The basemap ---------------------------------------------------------------------------------

async function buildBasemap(w: Work, options: BuildOptions): Promise<JobOutcome> {
  const urls = { ...PROTOMAPS_URLS, ...options.protomaps };
  const grid = await new Versions(join(w.dataDir, 'work', 'grid')).current();
  if (!grid) return waiting('Waiting for Build the grid, which outlines the region the basemap covers');
  const outline = join(grid, 'basemap-region.geojson');
  const outlineHash = sha256(await readFile(outline));
  const basemaps = new Versions(join(w.dataDir, 'work', 'basemap'));
  const current = await basemaps.current();
  const made = current ? await readJson<MadeFrom>(join(current, 'made-from.json')) : null;

  // Started by the grid, the basemap only follows a new outline; the newest planet build comes on schedule
  let build = made?.inputs['build'] ?? null;
  const sameArea = made?.inputs['outline'] === outlineHash && made?.inputs['maxZoom'] === String(BASEMAP_MAX_ZOOM);
  if (!build || !sameArea || w.context.trigger !== 'after') {
    const response = await fetch(urls.builds, { headers: { 'user-agent': USER_AGENT }, signal: w.context.signal });
    if (!response.ok) throw new Error(`${urls.builds} answered ${response.status}`);
    const builds = (await response.json()) as { key?: string }[];
    build = builds.at(-1)?.key ?? null;
    if (!build) throw new Error(`${urls.builds} lists no planet build`);
  }
  const newTiles = !current || !sameArea || build !== made?.inputs['build'];

  // The fonts and sprites of the styles, into the raw archive
  const assets: Record<string, string> = {};
  for (const [font, id] of Object.entries(FONTS)) {
    for (const range of GLYPH_RANGES) {
      const name = `fonts/${id}/${range}.pbf`;
      const file = await w.archive.download(w.context, {
        source: 'basemap', name, url: `${urls.assets}/fonts/${encodeURIComponent(font)}/${range}.pbf`, licence: 'SIL Open Font License 1.1, © The Noto Project Authors',
      });
      assets[name] = file.file.path;
    }
  }
  for (const sprite of SPRITES) {
    const name = `sprites/${sprite}`;
    const file = await w.archive.download(w.context, { source: 'basemap', name, url: `${urls.assets}/sprites/v4/${sprite}`, licence: 'MIT, © Mapzen' });
    assets[name] = file.file.path;
  }
  // The licence texts that go with the copies of the fonts and icons the pack serves
  for (const [name, url, licence] of [
    ['licences/noto-fonts-OFL.txt', `${urls.assets}/fonts/OFL.txt`, 'SIL Open Font License 1.1'],
    ['licences/icons-MIT.md', urls.iconsLicence, 'MIT'],
  ]) {
    const file = await w.archive.download(w.context, { source: 'basemap', name, url, licence });
    assets[name] = file.file.path;
  }
  const styles = { 'styles/style-layers.json': styleLayers('light'), 'styles/style-layers-dark.json': styleLayers('dark') };
  const wanted: MadeFrom = {
    revision: w.revision,
    inputs: {
      build, outline: outlineHash, maxZoom: String(BASEMAP_MAX_ZOOM),
      ...Object.fromEntries(await Promise.all(Object.entries(assets).map(async ([name, path]) => [name, sha256(await readFile(path))]))),
      ...Object.fromEntries(Object.entries(styles).map(([name, content]) => [name, sha256(content)])),
    },
  };
  if (!newTiles && sameInputs(made, wanted)) {
    // Started by a new grid, it passes the change on to the pack even when the basemap is the same
    return { changed: w.context.trigger === 'after', result: `Unchanged: planet build ${build.replace(/\.pmtiles$/, '')}` };
  }

  const id = versionId(w.context);
  const stage = await basemaps.staging(id);
  if (newTiles) {
    await w.context.log(`Cutting the region out of the planet build ${build}, up to zoom ${BASEMAP_MAX_ZOOM}`);
    await runProgram(w.context, {
      program: options.pmtiles, tmpDir: join(w.dataDir, 'tmp'), progress: [0, 0.9], logErrors: false,
      missing: `go-pmtiles is missing: ${options.pmtiles}. Install it, or set PMTILES.`,
    }, ['extract', `${urls.tiles}/${build}`, join(stage, 'basemap.pmtiles'), `--region=${outline}`, `--maxzoom=${BASEMAP_MAX_ZOOM}`]);
  } else {
    await place(join(current!, 'basemap.pmtiles'), join(stage, 'basemap.pmtiles'));
  }
  for (const [name, path] of Object.entries(assets)) await place(path, join(stage, name));
  for (const [name, content] of Object.entries(styles)) {
    await mkdir(dirname(join(stage, name)), { recursive: true });
    await writeFile(join(stage, name), content);
  }
  await writeFile(join(stage, 'made-from.json'), JSON.stringify(wanted));
  const dir = await basemaps.publish(stage, id);
  const size = (await stat(join(dir, 'basemap.pmtiles'))).size;
  return { changed: true, bytes: size, result: `Planet build ${build.replace(/\.pmtiles$/, '')} up to zoom ${BASEMAP_MAX_ZOOM}, ${formatBytes(size)}` };
}

// --- Pack the data ----------------------------------------------------------------------------------

/** The data packs, with the link the app serves the current one through. */
export function packVersions(dataDir: string, dataPackDir: string): Versions {
  return new Versions(join(dataDir, 'packs'), { link: dataPackDir, keep: 3 });
}

/** The id the data pack from before the jobs gets when it moves aside: it sorts before every other. */
const OLD_PACK = '00000000T000000Z-before-the-jobs';

async function buildPack(w: Work, options: BuildOptions & { dataPackDir: string }): Promise<JobOutcome> {
  const busy = await w.context.busy(['grid', 'basemap', 'world']);
  if (busy.length) return waiting(`Waiting for ${names(busy)}, which ${busy.length > 1 ? 'run' : 'runs'} now`);
  const parts = {
    grid: await new Versions(join(w.dataDir, 'work', 'grid')).current(),
    basemap: await new Versions(join(w.dataDir, 'work', 'basemap')).current(),
    world: await new Versions(join(w.dataDir, 'work', 'world')).current(),
  };
  const missing = Object.entries(parts).filter(([, dir]) => !dir).map(([part]) => part);
  if (missing.length) return waiting(`Waiting for ${names(missing)}`);
  const { grid, basemap, world } = parts as Record<keyof typeof parts, string>;
  const basemapMade = await readJson<MadeFrom>(join(basemap, 'made-from.json'));
  if (basemapMade?.inputs['outline'] !== sha256(await readFile(join(grid, 'basemap-region.geojson')))) {
    return waiting('Waiting for the Basemap of the new region');
  }

  const packs = packVersions(w.dataDir, options.dataPackDir);
  const wanted: MadeFrom = { revision: w.revision, inputs: { grid: basename(grid), basemap: basename(basemap), world: basename(world) } };
  const current = await packs.current();
  if (current && sameInputs(await readJson<MadeFrom>(join(current, 'made-from.json')), wanted)) {
    return waiting(`The data pack is up to date: ${basename(current)}`);
  }

  // A source that broke shows in the counts: the pack in use stays until a person has looked
  const before = current ? await readJson<PackFacts>(join(current, 'data', 'meta.json')) : null;
  const after = await readJson<PackFacts>(join(grid, 'meta.json'));
  const changes = before && after ? largeChanges(before, after) : 'not comparable';
  if (changes === 'not comparable') {
    if (before) await w.context.log('A new region or cell size, so there is nothing to compare the counts with');
  } else if (changes.length) {
    const what = changes.map(describeChange).join('; ');
    if (w.context.trigger !== 'manual') {
      throw new Error(`The new data was not switched in, because ${what}. A source may be broken; the map keeps the data from ${basename(current!)}. Run "Pack the data" by hand to switch to it anyway.`);
    }
    await w.context.log(`Switched in although ${what}, because the pack was started by hand`, 'warn');
  } else {
    await w.context.log('The counts are close to those of the pack in use');
  }

  const id = versionId(w.context);
  const stage = await packs.staging(id);
  await runStep(w.context, w.step([0, 0.9]), 'pack', [
    '--grid', grid, '--basemap', join(basemap, 'basemap.pmtiles'), '--fonts', join(basemap, 'fonts'), '--sprites', join(basemap, 'sprites'),
    '--styles', join(basemap, 'styles'), '--world', world, '--out', stage, '--id', id,
  ]);
  await writeFile(join(stage, 'made-from.json'), JSON.stringify(wanted));
  // The licence texts of the fonts and icons go with the copies the pack serves
  for (const name of ['noto-fonts-OFL.txt', 'icons-MIT.md']) {
    const from = join(basemap, 'licences', name);
    if (await exists(from)) await place(from, join(stage, 'licences', name));
  }
  // The pack from before the jobs is a folder, not a link: it moves aside once, and stays as an older version
  if (!(await packs.isLink()) && (await exists(options.dataPackDir))) {
    await w.context.log('Moving the data pack from before the jobs aside');
    await rename(options.dataPackDir, join(packs.root, OLD_PACK));
  }
  const dir = await packs.publish(stage, id);
  await w.context.progress(1);
  const meta = (await readJson<GridMeta & { files: Record<string, string>; basemap: { parts: number } }>(join(dir, 'data', 'meta.json')))!;
  return { changed: true, result: `Switched to the pack ${id}: ${count(Object.keys(meta.files).length, 'layer')}, ${count(meta.basemap.parts, 'basemap part')}` };
}

function basename(path: string): string {
  return path.split('/').at(-1)!;
}

// --- The jobs ---------------------------------------------------------------------------------------

/** "the 100 m grid of all of Denmark". */
export function describeGrid(settings: GridSettings): string {
  const region = REGIONS[settings.region] ?? `the municipalities ${settings.region.split(',').join(', ')}`;
  return `the ${settings.cellMetres} m grid of ${region}`;
}

/** The jobs that build the data pack from the fetched sources. */
export function buildJobs(options: BuildOptions): JobDefinition[] {
  const jobs: (Omit<JobDefinition, 'run' | 'enabledByDefault'> & { build: (w: Work) => Promise<JobOutcome> })[] = [
    {
      id: 'basemap', name: 'Basemap', kind: 'fetch', source: 'Protomaps', schedule: '0 2 * * 0', then: ['pack'],
      description: 'The region’s tiles up to zoom 12, cut out of the newest planet build, with the fonts, icons and styles.',
      build: (w) => buildBasemap(w, options),
    },
    {
      id: 'grid', name: 'Build the grid', kind: 'build', source: 'Boligmaskinen', schedule: '0 6 * * *', then: ['basemap'],
      description: `Every data layer on ${describeGrid(options.grid)}, sampled to the display grid.`,
      build: (w) => buildGrid(w, options.grid),
    },
    {
      id: 'roads', name: 'Road network', kind: 'build', source: 'OpenStreetMap', schedule: '15 6 * * *',
      description: 'The roads, paths and ferries of the OSM extract, which the travel times to your places are found on.',
      build: (w) => buildRoads(w),
    },
    {
      id: 'pack', name: 'Pack the data', kind: 'build', source: 'Boligmaskinen', schedule: '30 6 * * *', then: ['data-pack'],
      description: 'The data pack the map loads, built beside the one in use and switched in at once.',
      build: (w) => buildPack(w, { ...options, dataPackDir: options.dataPackDir! }),
    },
  ];
  return jobs.map(({ build, ...job }) => {
    const dataDir = options.dataDir;
    if (!dataDir || !options.dataPackDir) return { ...job, enabledByDefault: true, blocked: NEEDS_DATA_DIR };
    return { ...job, enabledByDefault: true, run: (context: JobContext) => build(work(context, { ...options, dataDir })) };
  });
}
