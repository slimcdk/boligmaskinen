import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 60_000 });
});

test('runs a real job from the jobs dialog, and shows its log', async ({ page }) => {
  await page.getByRole('button', { name: 'Data jobs' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.bar p')).toHaveText('Fetching and building the data on this server');
  await expect(dialog.getByRole('row').filter({ hasText: 'OpenStreetMap' })).toContainText('Not built yet');

  const row = dialog.getByRole('row').filter({ hasText: 'Check the data pack' });
  await row.getByRole('button', { name: 'Run Check the data pack now' }).click();
  await expect(row.locator('.status.succeeded')).toBeVisible();

  await dialog.getByText('Recent runs').click();
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
