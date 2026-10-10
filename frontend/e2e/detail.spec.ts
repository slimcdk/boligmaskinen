import { expect, Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pack, unpack } from './containers';

/**
 * The test data pack has no detail tiles: its display grid is already the grid's 100 m. These tests
 * cut its layers into tiles of 128 × 128 cells, as the pipeline's grid step cuts a national pack,
 * and serve them with a meta.json that names them.
 */
const PACK = join(__dirname, 'data-pack');
const SIZE = 128;
const LAYERS = ['forest', 'water', 'beach', 'noise', 'supermarket', 'school', 'daycare', 'station', 'turbine', 'density', 'zone', 'municipality', 'mask'];
const EARTH = 6378137;


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
