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
  await expect(dialog).toContainText('Data built 2026-');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('the footer shows which version is running', async ({ page }) => {
  await open(page);
  // Without a git repository the build is labelled as local
  await expect(page.locator('app-panel .foot .version')).toHaveText(/local build|v\d|[0-9a-f]{7}/);
});

test('the gear opens the data jobs, which can be run at once', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Data jobs' }).click();
  const dialog = page.getByRole('dialog');
  const row = dialog.getByRole('row').filter({ hasText: 'Planning zones' });
  await expect(row).toContainText('Every day at 03:30');
  await expect(row).toContainText(/in \d+ hours|tomorrow|in a moment|in \d+ minutes/);
  await expect(dialog.getByRole('row').filter({ hasText: 'Sale prices' })).toContainText('Needs approval from Geodatastyrelsen');

  await row.getByRole('button', { name: 'Run Planning zones now' }).click();
  await expect(row).toContainText('Running');
  await expect(row).toContainText('just now', { timeout: 10_000 });
  // The grid is rebuilt after a source has been fetched
  await expect(dialog.getByRole('row').filter({ hasText: 'Build the grid' })).toContainText('Running');

  await dialog.getByText('Recent runs').click();
  await dialog.getByRole('row').filter({ hasText: 'Planning zones' }).filter({ hasText: 'manual' }).first().click();
  await expect(dialog.getByRole('log')).toContainText('Looking for changes');
});
