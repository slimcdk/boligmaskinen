import { expect, Locator, Page, test } from '@playwright/test';

/** Open the app and wait until the data pack has loaded. */
async function open(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('mat-progress-bar')).toHaveCount(0, { timeout: 60_000 });
}

function block(page: Page, name: string): Locator {
  return page.locator('app-block-row').filter({ has: page.locator('.name', { hasText: new RegExp(`^${name}$`) }) });
}

async function expand(page: Page, name: string): Promise<Locator> {
  const row = block(page, name);
  await row.getByRole('button', { name: `Show settings for ${name}` }).click();
  return row;
}

/** The number of cells that meet the requirements, from the result's subline. */
async function cellsShown(page: Page): Promise<number> {
  const text = await page.locator('app-panel .subline').textContent();
  return Number(/([\d,]+) cells/.exec(text ?? '')![1].replace(/,/g, ''));
}

test('shows the map of the region and asks what matters', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('heading', { name: 'Where would you like to live?' })).toBeVisible();
  // The test data pack covers Aarhus Kommune
  await expect(page.locator('app-panel .head p')).toContainText('Aarhus Kommune');
  await expect(page.locator('.problem')).toHaveCount(0);
});

test('a suggestion adds a block and colours the map', async ({ page }) => {
  await open(page);
  await page.locator('mat-chip', { hasText: 'Forest' }).click();
  await expect(block(page, 'Forest')).toBeVisible();
  await expect(block(page, 'Forest').locator('.rule')).toHaveText('Full points up to 300 m · No points from 3.0 km');
  await expect(page.locator('app-panel .headline')).toHaveText(/^Median \d+ points$/);
  await expect(page.locator('app-legend')).toContainText('Points');
});

test('moving a slider rewrites the code and changes the result', async ({ page }) => {
  await open(page);
  await page.locator('mat-chip', { hasText: 'Supermarket' }).click();
  await expect(page.locator('app-panel .headline')).toHaveText(/Median \d+ points/);
  const before = await page.locator('app-panel .headline').textContent();
  const row = await expand(page, 'Supermarket');
  // Distance sliders use a square-root scale over 20 km: 30 % of the way is 1.8 km
  await row.getByRole('slider', { name: 'No points from' }).fill('300');
  await expect(row.locator('.rule')).toContainText('No points from 1.8 km');
  await expect(page.locator('app-panel .headline')).not.toHaveText(before!);
  await row.getByRole('button', { name: 'Code' }).click();
  await expect(page.getByRole('textbox', { name: 'Code' })).toHaveValue(/let zero = slider\(1800, 0, 20000, 50\)/);
});

test('the code editor checks the code and applies it', async ({ page }) => {
  await open(page);
  await page.locator('mat-chip', { hasText: 'Forest' }).click();
  const row = await expand(page, 'Forest');
  await row.getByRole('button', { name: 'Code' }).click();
  const code = page.getByRole('textbox', { name: 'Code' });
  const status = page.locator('app-code-dialog .status');
  await code.fill('ramp(forrest, 300, 3000)');
  await expect(status).toContainText('Unknown name “forrest”. Did you mean forest?');
  await code.fill('water / 10');
  await expect(status).toContainText('A score has to be between 0 and 1');
  await code.fill('// Near water\nramp(water, 200, 2000)');
  await expect(status).toContainText('Valid');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(row.locator('.rule')).toHaveText('Near water');
  await expect(row.locator('.rule')).not.toHaveClass(/error/);
});

test('a requirement removes the cells that do not meet it', async ({ page }) => {
  await open(page);
  await page.locator('mat-chip', { hasText: 'Quiet' }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('option', { name: /Planning zone/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  const row = block(page, 'Planning zone');
  await expect(row.locator('.required')).toHaveText('Required');
  await expect(page.locator('app-panel .subline')).toContainText('meet your requirements');
  const before = await cellsShown(page);
  await expand(page, 'Planning zone');
  await row.getByRole('checkbox', { name: 'Landzone' }).uncheck();
  await expect.poll(() => cellsShown(page)).toBeLessThan(before);
  await expect(row.locator('.rule')).toHaveText('Only Byzone');
});

test('a new place gets a block with a choice of how to travel, and its name follows the place', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Add place' }).click();
  await page.locator('.maplibregl-canvas').click({ position: { x: 520, y: 420 } });
  const row = block(page, 'Place 1');
  await expect(row).toBeVisible();
  await expand(page, 'Place 1');
  await row.getByRole('radio', { name: 'Bike' }).click();
  await expect(row.locator('.rule')).toContainText('Bike');

  await page.getByRole('textbox', { name: 'Name of the place' }).fill('Arbejde');
  await page.getByRole('textbox', { name: 'Name of the place' }).press('Enter');
  const renamed = block(page, 'Arbejde');
  await expect(renamed).toBeVisible();
  await renamed.getByRole('button', { name: 'Code' }).click();
  await expect(page.getByRole('textbox', { name: 'Code' })).toHaveValue(/choice\(2, arbejde_car, arbejde_bike, arbejde_walk, arbejde_train\)/);
});

test('blocks are remembered after a reload', async ({ page }) => {
  await open(page);
  await page.locator('mat-chip', { hasText: 'School' }).click();
  await block(page, 'School').getByRole('slider', { name: 'Weight of School' }).fill('7');
  await expect(block(page, 'School').locator('.weight-value')).toHaveText('7');
  await page.reload();
  await open(page);
  await expect(block(page, 'School').getByRole('slider', { name: 'Weight of School' })).toHaveValue('7');
});

/** The map's zoom, from the view the address keeps (#map=zoom/lat/lng). */
async function zoom(page: Page): Promise<number> {
  const hash = await page.evaluate(() => location.hash);
  return Number(/map=([\d.]+)\//.exec(hash)?.[1] ?? NaN);
}

test('the whole world is open to explore', async ({ page }) => {
  await open(page);
  await expect.poll(() => zoom(page)).toBeGreaterThan(5);
  for (let i = 0; i < 12; i++) {
    await page.locator('.maplibregl-ctrl-zoom-out').click();
    await page.waitForTimeout(300);
  }
  await expect.poll(() => zoom(page)).toBeLessThan(1.5);
  await expect(page.locator('.problem')).toHaveCount(0);
});

test('a link opens the same view', async ({ page }) => {
  await page.goto('/#map=10/55.676/12.568');
  await expect(page.locator('mat-progress-bar')).toHaveCount(0, { timeout: 60_000 });
  await expect.poll(() => zoom(page)).toBeCloseTo(10, 0);
});
