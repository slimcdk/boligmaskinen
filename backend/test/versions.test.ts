import { existsSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Versions } from '../src/pipeline/versions.ts';

describe('versions of a folder', () => {
  it('switches the link to a new version at once, and keeps the newest two', async () => {
    const root = mkdtempSync(join(tmpdir(), 'versions-'));
    const versions = new Versions(root);
    expect(await versions.current()).toBeNull();
    for (const id of ['20261008T030000Z-run1', '20261009T030000Z-run2', '20261010T030000Z-run3']) {
      const stage = await versions.staging(id);
      writeFileSync(join(stage, 'layers.gpkg'), id);
      expect(await versions.publish(stage, id)).toBe(join(root, id));
      expect(readFileSync(join(root, 'current', 'layers.gpkg'), 'utf8')).toBe(id);
    }
    expect(readlinkSync(join(root, 'current'))).toBe('20261010T030000Z-run3');
    expect(await versions.currentId()).toBe('20261010T030000Z-run3');
    expect(await versions.ids()).toEqual(['20261009T030000Z-run2', '20261010T030000Z-run3']);
    expect(readdirSync(root).sort()).toEqual(['20261009T030000Z-run2', '20261010T030000Z-run3', 'current']);
  });

  it('can keep its link somewhere else, and never deletes the version it points at', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'versions-'));
    const packs = new Versions(join(dataDir, 'packs'), { link: join(dataDir, 'data-pack'), keep: 1 });
    await packs.publish(await packs.staging('a'), 'a');
    expect(readlinkSync(join(dataDir, 'data-pack'))).toBe('packs/a');
    expect(await packs.isLink()).toBe(true);
    // A build that never got switched in, and one left half-built
    await packs.staging('b');
    await packs.prune();
    expect(existsSync(join(dataDir, 'packs', 'a'))).toBe(true);
    expect(existsSync(join(dataDir, 'packs', '.staging-b'))).toBe(false);
  });
});
