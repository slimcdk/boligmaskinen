import { expect, Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync, inflateSync } from 'node:zlib';

/**
 * The test data pack has no detail tiles: its display grid is already the grid's 100 m. These tests
 * cut its layers into tiles of 128 × 128 cells, as the pipeline's grid step cuts a national pack,
 * and serve them with a meta.json that names them.
 */
const PACK = join(__dirname, 'data-pack');
const SIZE = 128;
const LAYERS = ['forest', 'water', 'beach', 'noise', 'supermarket', 'school', 'daycare', 'station', 'turbine', 'density', 'zone', 'municipality', 'mask'];
const EARTH = 6378137;

/** The bytes in a byte container (frontend/src/app/data/byte-container.ts). */
function unpack(png: Buffer): Uint8Array {
  let pos = 8;
  let width = 0;
  let length = 0;
  const idat: Buffer[] = [];
  while (pos < png.length) {
    const size = png.readUInt32BE(pos);
    const kind = png.toString('latin1', pos + 4, pos + 8);
    const body = png.subarray(pos + 8, pos + 8 + size);
    if (kind === 'IHDR') width = body.readUInt32BE(0);
    if (kind === 'tEXt') length = Number(body.toString('latin1').split('\0')[1]);
    if (kind === 'IDAT') idat.push(body);
    pos += 12 + size;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const out = new Uint8Array(length);
  for (let row = 0, at = 0; at < length; row++) {
    const take = Math.min(width, length - at);
    out.set(raw.subarray(row * (width + 1) + 1, row * (width + 1) + 1 + take), at);
    at += take;
  }
  return out;
}

/** Bytes in a byte container, as pack.py writes them. */
function pack(payload: Uint8Array): Buffer {
  const width = 4096;
  const height = Math.max(1, Math.ceil(payload.length / width));
  const raw = Buffer.alloc((width + 1) * height);
  for (let row = 0; row < height; row++) raw.set(payload.subarray(row * width, (row + 1) * width), row * (width + 1) + 1);
  const chunk = (kind: string, body: Buffer) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(body.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(kind, 'latin1'), body])));
    return Buffer.concat([head, Buffer.from(kind, 'latin1'), body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 0, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr),
    chunk('tEXt', Buffer.from(`length\0${payload.length}`, 'latin1')), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** The test pack's meta.json with tiles, and the tiles. */
function tiles(): { meta: object; files: Map<string, Buffer> } {
  const meta = JSON.parse(readFileSync(join(PACK, 'data', 'meta.json'), 'utf8'));
  const { width, height, bounds } = meta;
  const layers = LAYERS.map((name) => unpack(readFileSync(join(PACK, 'data', meta.files[name]))));
  const x0 = (EARTH * bounds.west * Math.PI) / 180;
  const x1 = (EARTH * bounds.east * Math.PI) / 180;
  const y1 = EARTH * Math.log(Math.tan(Math.PI / 4 + (bounds.north * Math.PI) / 360));
  const columns = Math.ceil(width / SIZE);
  const rows = Math.ceil(height / SIZE);
  const files = new Map<string, Buffer>();
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < columns; tx++) {
      const data = new Uint8Array(LAYERS.length * SIZE * SIZE);
      layers.forEach((layer, k) => {
        for (let row = 0; row < SIZE && ty * SIZE + row < height; row++) {
          const from = (ty * SIZE + row) * width + tx * SIZE;
          data.set(layer.subarray(from, from + Math.min(SIZE, width - tx * SIZE)), k * SIZE * SIZE + row * SIZE);
        }
      });
      files.set(`${tx}-${ty}`, pack(data));
    }
  }
  const detail = { cellMetres: 100, size: SIZE, columns, rows, origin: { x: x0, y: y1 }, pixel: (x1 - x0) / width, layers: LAYERS, available: [...files.keys()] };
  return { meta: { ...meta, tiles: detail }, files };
}

async function withTiles(page: Page): Promise<string[]> {
  const { meta, files } = tiles();
  const fetched: string[] = [];
  await page.route('**/data-pack/data/meta.json', (route) => route.fulfill({ json: meta }));
  await page.route('**/data-pack/tiles/*.png', (route) => {
    const key = route.request().url().split('/tiles/')[1].replace('.png', '');
    fetched.push(key);
    return route.fulfill({ body: files.get(key)!, contentType: 'image/png' });
  });
  return fetched;
}

test('zoomed in, the map is drawn from the detail tiles around the view, and explains a spot from them', async ({ page }) => {
  const fetched = await withTiles(page);
  await page.goto('/#map=9/56.15/10.2');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 60_000 });
  await page.locator('mat-chip', { hasText: 'Forest' }).click();
  await expect(page.locator('app-map-panel app-histogram canvas')).toHaveAttribute('aria-label', /cells/);
  // Zoomed out, the region's grid is enough
  await page.waitForTimeout(1_000);
  expect(fetched).toEqual([]);

  await page.goto(`${page.url().split('#')[0]}#map=13/56.1567/10.2108`);
  await expect.poll(() => fetched.length).toBeGreaterThan(0);
  expect(fetched.length).toBeLessThanOrEqual(4);
  await page.locator('.maplibregl-canvas').click({ position: { x: 900, y: 450 } });
  const popup = page.locator('.maplibregl-popup');
  await expect(popup.locator('h3')).toHaveText(/^(\d+ points|Left out)$/);
  await expect(popup.locator('tr').first()).toContainText('Forest');
});
