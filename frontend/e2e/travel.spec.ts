import { expect, Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pack } from './containers';

const META = JSON.parse(readFileSync(join(__dirname, 'data-pack', 'data', 'meta.json'), 'utf8')) as { width: number; height: number };
const ID = '0123456789abcdef01234567';
const MINUTES = { car: 40, bike: 34, walk: 56 };

async function open(page: Page): Promise<void> {
  await page.goto('/#map=12/56.1567/10.2108');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('mat-progress-bar')).toHaveCount(0, { timeout: 60_000 });
}

async function addPlace(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Add place' }).click();
  await page.locator('.maplibregl-canvas').click({ position: { x: 700, y: 450 } });
  await expect(page.locator('app-block-row .name', { hasText: /^Place 1$/ })).toBeVisible();
}

test('a place gets its travel times from the road network when the server has found them', async ({ page }) => {
  // The server finds them for a moment, then serves every mode: the same minutes everywhere
  let asked = 0;
  await page.route('**/api/travel', (route) => route.fulfill({ json: { id: ID, state: ++asked < 2 ? 'working' : 'ready' } }));
  await page.route(`**/api/travel/${ID}/*`, (route) => {
    const mode = route.request().url().split('/').pop() as keyof typeof MINUTES;
    return route.fulfill({ body: pack(new Uint8Array(META.width * META.height).fill(MINUTES[mode])), contentType: 'image/png' });
  });
  await open(page);
  await addPlace(page);
  await expect(page.locator('.place .route')).toHaveText('Travel times from the road network');
  expect(asked).toBeGreaterThanOrEqual(2);

  // The place's block reads them: by car 40 minutes from anywhere, where full points end at 15 and
  // none are left at 45, though the spot is a few minutes away as the crow flies
  await page.locator('.maplibregl-canvas').click({ position: { x: 760, y: 420 } });
  const popup = page.locator('.maplibregl-popup');
  await expect(popup.locator('tr', { hasText: 'Place 1' })).toContainText('0.17');
});

test('without a server that finds them, travel times are estimated from the distance', async ({ page }) => {
  await page.route('**/api/travel', (route) => route.fulfill({ json: { id: '', state: 'unavailable', message: 'The road network is not built yet' } }));
  await open(page);
  await addPlace(page);
  await expect(page.locator('.place .route')).toHaveText('Travel times estimated from the distance');
});
