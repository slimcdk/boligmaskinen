import { expect, type Page, test } from '@playwright/test';
import { meanDifference } from './pixels';

const map = (page: Page) => page.locator('app-map-view');
const summary = (page: Page) => page.locator('app-map-panel mat-panel-description');

/** Wait until the map has loaded what it shows and drawn it. */
async function settled(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

test('the background Terrain shades the land, and the browser keeps the choice', async ({ page }) => {
  // Over Aarhus, where the test data pack has the terrain's tiles
  await page.goto('/#map=10.5/56.15/10.12');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('mat-progress-bar')).toHaveCount(0, { timeout: 60_000 });
  // The settings first: the panel grows, and the map's view with it
  await page.getByText('Map settings').click();
  await expect(page.getByRole('radio', { name: 'Map', exact: true })).toBeChecked();
  await settled(page);
  const plain = await map(page).screenshot();

  await page.getByRole('radio', { name: 'Terrain' }).click();
  await expect(summary(page)).toContainText('terrain');
  await settled(page);
  // The shading darkens the slopes away from the light and lightens the others
  expect(meanDifference(plain, await map(page).screenshot())).toBeGreaterThan(1);

  await page.getByRole('radio', { name: 'Map', exact: true }).click();
  await expect(summary(page)).not.toContainText('terrain');
  await settled(page);
  expect(meanDifference(plain, await map(page).screenshot())).toBeLessThan(0.3);

  // The map settings stay with the browser
  await page.getByRole('radio', { name: 'Terrain' }).click();
  await page.reload();
  await expect(page.locator('mat-progress-bar')).toHaveCount(0, { timeout: 60_000 });
  await expect(summary(page)).toContainText('terrain');
});
