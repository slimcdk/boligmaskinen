import { expect, Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('mat-progress-bar')).toHaveCount(0, { timeout: 60_000 });
}

test('"About the data" opens the text and the sources', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'About the data' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'How the map is made' })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Plandata.dk' })).toHaveAttribute('href', 'https://www.plandata.dk');
  // A section per source, with its licence and the credit it asks for
  const osm = dialog.getByRole('region', { name: 'OpenStreetMap' });
  await expect(osm.getByRole('link', { name: 'Open Database License 1.0 (ODbL)' })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
  await expect(osm).toContainText('© OpenStreetMap contributors');
  await expect(dialog.getByRole('region', { name: 'ESA WorldCover' })).toContainText('Contains modified Copernicus Sentinel data');
  await expect(dialog).toContainText('Data built 2026-');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('the footer shows which version is running, and links to the repository', async ({ page }) => {
  await open(page);
  // Without a git repository the build is labelled as local
  await expect(page.locator('app-panel .foot .version')).toHaveText(/local build|v\d|[0-9a-f]{7}/);
  await expect(page.locator('app-panel .foot a.version')).toHaveAttribute('href', 'https://github.com/slimcdk/boligmaskinen');
});

test('the logo stands by the name, and the browser tab shows the same mark', async ({ page, request }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await open(page);
  const logo = page.locator('app-map-panel .head svg.logo');
  await expect(logo).toBeVisible();
  // Drawn in the theme's primary colour (azure 40 in light mode)
  await expect(logo).toHaveCSS('fill', 'rgb(0, 92, 187)');

  const href = await page.locator('link[rel="icon"][type="image/svg+xml"]').getAttribute('href');
  const favicon = await request.get(href!);
  expect(favicon.ok()).toBe(true);
  expect(await favicon.text()).toContain(`d="${await logo.locator('path').getAttribute('d')}"`);
});

test('the gear opens the data jobs, which can be run at once', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Data jobs' }).click();
  const dialog = page.getByRole('dialog');
  // The dev server has no backend, so the dialog shows its preview
  await expect(dialog.locator('.head p')).toHaveText('Preview without a backend: the runs are simulated');
  const row = dialog.getByRole('row').filter({ hasText: 'Planning zones' });
  await expect(row).toContainText('Every day at 03:30');
  await expect(row).toContainText(/in \d+ hours?|tomorrow|in a moment|in \d+ minutes?/);
  await expect(dialog.getByRole('row').filter({ hasText: 'Sale prices' })).toContainText('Needs approval from Geodatastyrelsen');

  await row.getByRole('button', { name: 'Run Planning zones now' }).click();
  await expect(row).toContainText('Running');
  await expect(row).toContainText('just now', { timeout: 10_000 });
  // The grid is rebuilt after a source has been fetched
  await expect(dialog.getByRole('row').filter({ hasText: 'Build the grid' })).toContainText('Running');

  await dialog.getByRole('tab', { name: 'Recent runs' }).click();
  await dialog.getByRole('row').filter({ hasText: 'Planning zones' }).filter({ hasText: 'manual' }).first().click();
  await expect(dialog.getByRole('log')).toContainText('Looking for changes');
});
