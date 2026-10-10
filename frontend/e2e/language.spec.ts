import { expect, Page, test } from '@playwright/test';

/** Open the app and wait until the data pack has loaded. */
async function open(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('mat-progress-bar')).toHaveCount(0, { timeout: 60_000 });
}

test.describe('a Danish browser', () => {
  test.use({ locale: 'da-DK' });

  test('gets the app in Danish, with Danish numbers', async ({ page }) => {
    const missing: string[] = [];
    page.on('console', (message) => {
      if (/missing translation/i.test(message.text())) missing.push(message.text());
    });
    await open(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'da');
    await expect(page.getByRole('heading', { name: 'Hvor vil du gerne bo?' })).toBeVisible();
    await page.locator('mat-chip', { hasText: 'Skov' }).click();
    const forest = page.locator('app-block-row').filter({ has: page.locator('.name', { hasText: /^Skov$/ }) });
    await expect(forest.locator('.rule')).toHaveText('Fulde point op til 300 m · Ingen point fra 3,0 km');
    await expect(page.locator('app-map-panel app-histogram canvas')).toHaveAttribute('aria-label', /^Point for de [\d.]+ celler, der opfylder dine krav, median \d+$/);
    await forest.getByRole('button', { name: 'Vis indstillinger for Skov' }).click();
    await expect(forest.getByRole('slider', { name: 'Ingen point ved' })).toBeVisible();

    // The spot under a click, explained in Danish
    await page.goto(`${page.url().split('#')[0]}#map=13/56.1567/10.2108`);
    await page.locator('.maplibregl-canvas').click({ position: { x: 900, y: 450 } });
    const popup = page.locator('.maplibregl-popup');
    await expect(popup.locator('h3')).toHaveText(/^(\d+ point|Sorteret fra)$/);
    await expect(popup.locator('tr').first()).toContainText('Skov');

    await page.getByRole('button', { name: 'Om data' }).click();
    const about = page.getByRole('dialog');
    await expect(about.getByRole('heading', { name: 'Sådan bliver kortet lavet' })).toBeVisible();
    await expect(about.getByRole('region', { name: 'STIL Dagtilbudsregisteret' })).toContainText('Kilde: Styrelsen for It og Læring, Dagtilbudsregisteret');
    await about.getByRole('button', { name: 'Luk' }).click();

    await page.getByRole('button', { name: 'Datajob' }).click();
    const jobs = page.getByRole('dialog');
    await expect(jobs.getByRole('row').filter({ hasText: 'Planzoner' })).toContainText('Hver dag kl. 03:30');
    await jobs.getByRole('button', { name: 'Luk' }).click();
    expect(missing).toEqual([]);
  });

  test('can switch to English, which the app remembers', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Sprog: Dansk' }).click();
    await expect(page.getByRole('menuitemradio', { name: 'Dansk' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { name: 'Where would you like to live?' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Language: English' })).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test('an English browser gets the app in English, and can switch to Danish', async ({ page }) => {
  await open(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  // Escape closes the menu, and leaves the panel open
  await page.getByRole('button', { name: 'Language: English' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Language: English' })).toBeVisible();
  await page.getByRole('button', { name: 'Language: English' }).click();
  await page.getByRole('menuitemradio', { name: 'Dansk' }).click();
  await expect(page.getByRole('heading', { name: 'Hvor vil du gerne bo?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Om data' })).toBeVisible();
});
