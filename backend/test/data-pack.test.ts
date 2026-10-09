import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkDataPack, formatBytes } from '../src/jobs/data-pack.ts';
import type { JobContext, LogLine } from '../src/jobs/types.ts';

let dir: string;
const FILES = [
  'data/meta.json', 'data/forest.png', 'data/water.png', 'basemap/part-0.png', 'data/municipalities.json', 'fonts.json',
  'style-layers.json', 'style-layers-dark.json', 'sprites/light.json', 'sprites/light.png', 'sprites/dark.json', 'sprites/dark.png',
  'world/land.json', 'world/lakes.json', 'world/boundaries.json', 'world/countries.json', 'world/places.json',
];

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'data-pack-'));
  for (const file of FILES) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), 'x'.repeat(1000));
  }
  writeFileSync(join(dir, 'data/meta.json'), JSON.stringify({
    built: '2026-10-07', region: { name: 'Aarhus Kommune' }, width: 277, height: 379, cellMetres: 100,
    files: { forest: 'forest.png', water: 'water.png' }, basemap: { parts: 1 },
  }));
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

function context(): { context: JobContext; lines: LogLine[] } {
  const lines: LogLine[] = [];
  return {
    lines,
    context: {
      log: async (text, level = 'info') => { lines.push({ at: '', level, text }); },
      progress: async () => undefined,
      signal: new AbortController().signal,
      dataPackDir: dir,
      db: undefined as never,
      runId: '1',
      trigger: 'manual',
      busy: async () => [],
    },
  };
}

describe('formatBytes', () => {
  it('writes sizes the way people read them', () => {
    expect([512, 17_400, 7_512_000, 83_400_000, 1_250_000_000].map(formatBytes)).toEqual(['512 B', '17 kB', '7.5 MB', '83 MB', '1.3 GB']);
  });
});

describe('checking the data pack', () => {
  it('reports the region, the layers and the size', async () => {
    const { context: c, lines } = context();
    const outcome = await checkDataPack(c);
    expect(lines.map((l) => l.text)).toEqual([
      'Region Aarhus Kommune, built 2026-10-07: 277 × 379 cells of 100 m',
      '2 layers, 1 basemap part, 16 kB in all',
    ]);
    expect(outcome).toEqual({ result: '2 layers', bytes: expect.any(Number) });
    expect(outcome.bytes).toBeGreaterThan(16_000);
  });

  it('fails and names what is missing', async () => {
    unlinkSync(join(dir, 'data/water.png'));
    writeFileSync(join(dir, 'world/places.json'), '');
    await expect(checkDataPack(context().context)).rejects.toThrow('2 files are missing or empty: data/water.png, world/places.json');
  });

  it('says so when there is no data pack', async () => {
    await expect(checkDataPack({ ...context().context, dataPackDir: join(dir, 'nothing') })).rejects.toThrow(/^Cannot read data\/meta.json/);
  });
});
