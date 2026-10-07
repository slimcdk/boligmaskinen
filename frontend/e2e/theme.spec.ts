import { expect, Page, test } from '@playwright/test';
import { meanLuminance } from './pixels';

/** Open the app on a view of the world, which is mostly land and sea. */
async function openWorld(page: Page): Promise<void> {
  await page.goto('/#map=2.2/50/10');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('mat-progress-bar')).toHaveCount(0, { timeout: 60_000 });
}

/** How bright the map looks on screen, 0–255. */
const mapBrightness = async (page: Page) => meanLuminance(await page.locator('app-map-view').screenshot());

/** How bright the page behind the panel is, 0–255. */
const pageBrightness = (page: Page) =>
  page.evaluate(() => {
    const [r, g, b] = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g)!.map(Number);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  });

test('follows the light or dark setting of the system', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openWorld(page);
  await expect.poll(() => mapBrightness(page)).toBeLessThan(90);
  expect(await pageBrightness(page)).toBeLessThan(60);

  // Switching the system while the app is open recolours it at once
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => mapBrightness(page)).toBeGreaterThan(150);
  expect(await pageBrightness(page)).toBeGreaterThan(200);
});

test('the theme button picks dark mode, which is kept for the next visit', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openWorld(page);
  await expect.poll(() => mapBrightness(page)).toBeGreaterThan(150);

  await page.getByRole('button', { name: 'Theme: System' }).click();
  await expect(page.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('menuitemradio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-scheme', 'dark');
  await expect.poll(() => mapBrightness(page)).toBeLessThan(90);
  expect(await pageBrightness(page)).toBeLessThan(60);

  await page.reload();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Theme: Dark' })).toBeVisible();
  await expect.poll(() => mapBrightness(page)).toBeLessThan(90);

  // Back to following the system, which is light
  await page.getByRole('button', { name: 'Theme: Dark' }).click();
  await page.getByRole('menuitemradio', { name: 'System' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-scheme');
  await expect.poll(() => mapBrightness(page)).toBeGreaterThan(150);
});
