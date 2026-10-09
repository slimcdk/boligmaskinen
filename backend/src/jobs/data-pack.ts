import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { JobContext, JobOutcome } from './types.ts';

interface Meta {
  built?: string;
  region?: { name?: string };
  width?: number;
  height?: number;
  cellMetres?: number;
  files?: Record<string, string>;
  basemap?: { parts?: number };
  tiles?: { available?: string[] };
}

/** "18 kB", "7.5 MB", "83 MB". */
export function formatBytes(bytes: number): string {
  const number = (n: number, digits: number) => n.toLocaleString('en-US', { maximumFractionDigits: digits });
  if (bytes < 1e3) return `${bytes} B`;
  if (bytes < 1e6) return `${number(bytes / 1e3, 0)} kB`;
  if (bytes < 1e9) return `${number(bytes / 1e6, bytes < 1e7 ? 1 : 0)} MB`;
  return `${number(bytes / 1e9, 1)} GB`;
}

const count = (n: number, word: string) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

/** The size of every file under a folder. */
async function folderSize(dir: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) total += (await stat(join(entry.parentPath, entry.name))).size;
  }
  return total;
}

/**
 * Checks the data pack the map loads: that its description is readable and that every layer,
 * basemap part and world file it names is there. It changes nothing.
 */
export async function checkDataPack(context: JobContext): Promise<JobOutcome> {
  const dir = context.dataPackDir;
  if (!dir) throw new Error('There is no data pack folder: set DATA_PACK_DIR');
  let meta: Meta;
  try {
    meta = JSON.parse(await readFile(join(dir, 'data', 'meta.json'), 'utf8')) as Meta;
  } catch (error) {
    throw new Error(`Cannot read data/meta.json in ${dir}: ${(error as Error).message}`, { cause: error });
  }
  await context.log(`Region ${meta.region?.name ?? 'unknown'}, built ${meta.built ?? 'on an unknown date'}: ${meta.width} × ${meta.height} cells of ${meta.cellMetres} m`);
  await context.progress(0.2);

  const expected = [
    ...Object.values(meta.files ?? {}).map((file) => `data/${file}`),
    ...Array.from({ length: meta.basemap?.parts ?? 0 }, (_, i) => `basemap/part-${i}.png`),
    ...(meta.tiles?.available ?? []).map((key) => `tiles/${key}.png`),
    'data/municipalities.json', 'fonts.json', 'style-layers.json', 'style-layers-dark.json',
    'sprites/light.json', 'sprites/light.png', 'sprites/dark.json', 'sprites/dark.png',
    'world/land.json', 'world/lakes.json', 'world/boundaries.json', 'world/countries.json', 'world/places.json',
  ];
  const missing: string[] = [];
  for (const [i, file] of expected.entries()) {
    if (context.signal.aborted) throw new Error('Cancelled');
    try {
      const info = await stat(join(dir, file));
      if (!info.isFile() || info.size === 0) missing.push(file);
    } catch {
      missing.push(file);
    }
    await context.progress(0.2 + (0.7 * (i + 1)) / expected.length);
  }
  const bytes = await folderSize(dir);
  const layers = Object.keys(meta.files ?? {}).length;
  await context.log(`${count(layers, 'layer')}, ${count(meta.basemap?.parts ?? 0, 'basemap part')}, ${formatBytes(bytes)} in all`);
  if (missing.length) {
    throw new Error(`${missing.length} file${missing.length === 1 ? ' is' : 's are'} missing or empty: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}`);
  }
  // The dialog shows the size next to the result
  return { result: count(layers, 'layer'), bytes };
}
