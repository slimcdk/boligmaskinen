import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 60_000 });
});

test('runs a real job from the jobs dialog, and shows its log', async ({ page }) => {
  await page.getByRole('button', { name: 'Data jobs' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.head p')).toHaveText('Fetching and building the data on this server');
  await expect(dialog.getByRole('row').filter({ hasText: 'OpenStreetMap' })).toContainText('Not built yet');

  const row = dialog.getByRole('row').filter({ hasText: 'Check the data pack' });
  await row.getByRole('button', { name: 'Run Check the data pack now' }).click();
  await expect(row.locator('.status.succeeded')).toBeVisible();

  await dialog.getByRole('tab', { name: 'Recent runs' }).click();
  await dialog.locator('table.runs tr.mat-mdc-row').filter({ hasText: 'Check the data pack' }).first().click();
  const log = dialog.getByRole('log');
  await expect(log).toContainText('Region Aarhus Kommune');
  await expect(log).toContainText(/\d+ layers, 1 basemap part, [\d.]+ MB in all/);
  await expect(log).toContainText(/Done: \d+ layers/);
});

test('shows the version the server reports', async ({ page }) => {
  const revision = process.env['EXPECTED_REVISION'];
  test.skip(!revision, 'Set EXPECTED_REVISION to the commit the app was built from');
  await expect(page.locator('app-panel .foot .version')).toHaveText(revision!.slice(0, 7));
});

test('a map saved in one browser opens in another', async ({ browser, page }) => {
  const name = `Saved map ${Date.now()}`;
  const onServer = async () => ((await (await page.request.get('/api/profile')).json()) as { maps: { name: string; blocks: unknown[] }[] }).maps.find((m) => m.name === name);
  await page.getByRole('button', { name: /^Map: / }).click();
  await page.getByRole('menuitem', { name: 'New map' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Name of the map' }).fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.locator('mat-chip', { hasText: 'Forest' }).click();
  await expect.poll(async () => (await onServer())?.blocks.length).toBe(1);
  await expect(page.getByRole('img', { name: 'Your maps are saved on the server' })).toBeVisible();

  // Another browser, with nothing of its own
  const other = await (await browser.newContext()).newPage();
  await other.goto('/');
  await expect(other.locator('.maplibregl-canvas')).toBeVisible({ timeout: 60_000 });
  await other.getByRole('button', { name: /^Map: / }).click();
  await other.getByRole('menuitemradio', { name }).click();
  await expect(other.locator('app-block-row .name', { hasText: /^Forest$/ })).toBeVisible();

  // Deleted there, it is gone from the server
  await other.getByRole('button', { name: /^Map: / }).click();
  await other.getByRole('menuitem', { name: 'Delete this map' }).click();
  await other.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect.poll(onServer).toBeUndefined();
  await other.context().close();
});
