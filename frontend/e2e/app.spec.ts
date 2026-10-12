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

/** The result in words, which the histogram carries for screen readers. */
const result = (page: Page) => page.locator('app-map-panel app-histogram canvas');

/** The number of cells that meet the requirements, from the result in words. */
async function cellsShown(page: Page): Promise<number> {
  const text = await result(page).getAttribute('aria-label');
  return Number(/([\d,]+) cells/.exec(text ?? '')![1].replace(/,/g, ''));
}

test('shows the map of the region and asks what matters', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('heading', { name: 'Where would you like to live?' })).toBeVisible();
  // The map's card says what the map shows, and the weighting below does not say it again
  await expect(page.getByText(/colours every 100 m cell/)).toHaveCount(1);
  // The test data pack covers Aarhus Kommune
  await expect(page.locator('app-map-panel .head p')).toContainText('Aarhus Kommune');
  await expect(page.locator('.problem')).toHaveCount(0);
});

test('a suggestion adds a block and colours the map', async ({ page }) => {
  await open(page);
  await page.locator('mat-chip', { hasText: 'Forest' }).click();
  await expect(block(page, 'Forest')).toBeVisible();
  await expect(block(page, 'Forest').locator('.rule')).toHaveText('Full points up to 300 m · No points from 3.0 km');
  await expect(result(page)).toHaveAttribute('aria-label', /^Points of the [\d,]+ cells that meet your requirements, median \d+$/);
  // The map itself has no legend and no list of sources: "About the data" has them
  await expect(page.locator('.maplibregl-ctrl-attrib')).toHaveCount(0);
});

test('a click on the map explains the points of the spot', async ({ page }) => {
  await open(page);
  await page.locator('mat-chip', { hasText: 'Forest' }).click();
  await expect(result(page)).toHaveAttribute('aria-label', /cells/);
  // Aarhus C, in the middle of the test data pack: the weighting runs in the heat worker, which explains it too
  await page.goto(`${page.url().split('#')[0]}#map=13/56.1567/10.2108`);
  await page.locator('.maplibregl-canvas').click({ position: { x: 900, y: 450 } });
  const popup = page.locator('.maplibregl-popup');
  await expect(popup.locator('h3')).toHaveText(/^(\d+ points|Left out)$/);
  await expect(popup.locator('tr').first()).toContainText('Forest');
});

test('moving a slider rewrites the code and changes the result', async ({ page }) => {
  await open(page);
  await page.locator('mat-chip', { hasText: 'Supermarket' }).click();
  await expect(result(page)).toHaveAttribute('aria-label', /median \d+/);
  const before = await result(page).getAttribute('aria-label');
  const row = await expand(page, 'Supermarket');
  // Distance sliders use a square-root scale over 20 km: 30 % of the way is 1.8 km
  await row.getByRole('slider', { name: 'No points at' }).fill('300');
  await expect(row.locator('.rule')).toContainText('No points from 1.8 km');
  await expect(result(page)).not.toHaveAttribute('aria-label', before!);
  await row.getByRole('button', { name: 'Code' }).click();
  await expect(page.getByRole('textbox', { name: 'Code' })).toHaveValue(/let zero = slider\(1800, 0, 20000, 50\)/);
});

test('turning a block around gives full points at the other end', async ({ page }) => {
  await open(page);
  await page.locator('mat-chip', { hasText: 'Quiet' }).click();
  await expect(block(page, 'Quiet').locator('.rule')).toHaveText('Full points up to 45 dB · No points from 65 dB');
  const row = await expand(page, 'Quiet');
  await row.getByRole('button', { name: 'Turn around' }).click();
  const noisy = block(page, 'Noisy');
  await expect(noisy.locator('.rule')).toHaveText('No points below 45 dB · Full points from 65 dB');
  await noisy.getByRole('button', { name: 'Code' }).click();
  await expect(page.getByRole('textbox', { name: 'Code' })).toHaveValue(/let full = slider\(65, .*\/\/ Full points at \(dB\)/);
});

test('the heatmap\'s colours can be chosen, smooth or in steps', async ({ page }) => {
  await open(page);
  await page.locator('mat-chip', { hasText: 'Forest' }).click();
  await page.getByText('Map settings').click();
  const swatch = page.locator('app-map-panel mat-select-trigger .swatch');
  await page.getByRole('combobox', { name: 'Heatmap colours' }).click();
  await page.getByRole('option', { name: /Azure/ }).click();
  const gradient = () => swatch.evaluate((el) => getComputedStyle(el).backgroundImage);
  // Azure's lightest tone (90) starts the scale on the light map, with stops at every quarter
  await expect.poll(gradient).toMatch(/^linear-gradient\(90deg, rgb\(215, 227, 255\) 0%, .* 25%/);
  await page.getByRole('radio', { name: 'Steps' }).click();
  // Five steps with hard edges: every fifth
  await expect.poll(gradient).toMatch(/ 20%.* 40%.* 60%.* 80%/);
  await expect(page.locator('app-map-panel mat-panel-description')).toContainText('Azure in steps');
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

test('the newest values score the map: the air, solar parks and turbines by their height', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  for (const name of [/^Clean air/, /^Away from solar parks/, /^Away from wind turbines, by height/]) {
    await page.getByRole('option', { name }).click();
  }
  await page.getByRole('button', { name: 'Done' }).click();
  for (const name of ['Clean air', 'Away from solar parks', 'Away from wind turbines, by height']) {
    // Each reads a layer of the test data pack, so none says it has no data
    await expect(block(page, name).locator('.rule')).not.toHaveClass(/error/);
  }
  await expect(block(page, 'Away from wind turbines, by height').locator('.rule')).toHaveText('No points below 4 heights · Full points from 10 heights');
  await expect(result(page)).toHaveAttribute('aria-label', /median \d+/);
});

test('airports, airfields and air stations score the map', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  for (const name of [/^Away from airports/, /^Away from airfields/, /^Away from air stations/]) {
    await page.getByRole('option', { name }).click();
  }
  await page.getByRole('button', { name: 'Done' }).click();
  for (const name of ['Away from airports', 'Away from airfields', 'Away from air stations']) {
    // Each reads a layer of the test data pack, so none says it has no data
    await expect(block(page, name).locator('.rule')).not.toHaveClass(/error/);
  }
  await expect(block(page, 'Away from airports').locator('.rule')).toHaveText('No points below 3.0 km · Full points from 10 km');
  await expect(result(page)).toHaveAttribute('aria-label', /median \d+/);
});

test('protected areas and Natura 2000 score the map, and "Free to build" leaves out the cells inside one', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  for (const name of [/^Near protected nature/, /^Near a protected area/]) {
    await page.getByRole('option', { name }).click();
  }
  await page.getByRole('button', { name: 'Done' }).click();
  for (const name of ['Near protected nature', 'Near a protected area']) {
    // Each reads a layer of the test data pack, so none says it has no data
    await expect(block(page, name).locator('.rule')).not.toHaveClass(/error/);
  }
  await expect(block(page, 'Near protected nature').locator('.rule')).toHaveText('Full points up to 1.0 km · No points from 5.0 km');
  const before = await cellsShown(page);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('option', { name: /^Free to build/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(block(page, 'Free to build')).toBeVisible();
  await expect.poll(() => cellsShown(page)).toBeLessThan(before);
});

test('pharmacies, libraries, power lines, plans, gravel pits, district heating and the height score the map', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  for (const name of [/^Pharmacy/, /^Library/, /^Away from power lines/, /^Away from planned roads and railways/, /^Away from new local plans/, /^District heating/,
    /^Away from consequence zones/, /^Away from gravel pits(?! to come)/, /^Away from gravel pits to come/, /^Outside building lines/, /^Frequent public transport/, /^Soft water/, /^High ground/, /^High incomes/, /^Low nursery prices/, /^Small classes/]) {
    await page.getByRole('option', { name }).click();
  }
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(block(page, 'Away from power lines').locator('.rule')).toHaveText('No points below 100 m · Full points from 500 m');
  await expect(block(page, 'High incomes').locator('.rule')).toHaveText('No points below 260,000 kr. · Full points from 320,000 kr.');
  for (const name of ['Pharmacy', 'Library', 'Away from power lines', 'Away from planned roads and railways', 'Away from new local plans', 'District heating',
    'Away from consequence zones', 'Away from gravel pits', 'Away from gravel pits to come', 'Outside building lines', 'Frequent public transport', 'Soft water', 'High ground', 'High incomes', 'Low nursery prices', 'Small classes']) {
    // Each reads a layer of the test data pack, so none says it has no data
    await expect(block(page, name).locator('.rule')).not.toHaveClass(/error/);
  }
  await expect(block(page, 'Pharmacy').locator('.rule')).toHaveText('Full points up to 1.0 km · No points from 5.0 km');
  await expect(block(page, 'Away from gravel pits').locator('.rule')).toHaveText('No points below 200 m · Full points from 1.0 km');
  await expect(block(page, 'Frequent public transport').locator('.rule')).toHaveText('No points below 2 per hour · Full points from 12 per hour');
  await expect(block(page, 'High ground').locator('.rule')).toHaveText('No points below 2 m a.s.l. · Full points from 10 m a.s.l.');
  await expect(result(page)).toHaveAttribute('aria-label', /median \d+/);
});

test('chargers for electric cars score the map by the providers ticked', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('option', { name: /^EV charger/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  const row = block(page, 'EV charger');
  // Every provider counts at first, so the summary gives the distances alone
  await expect(row.locator('.rule')).toHaveText('Full points up to 500 m · No points from 3.0 km');
  await expect(result(page)).toHaveAttribute('aria-label', /median \d+/);
  const median = async () => Number(/median (\d+)/.exec((await result(page).getAttribute('aria-label')) ?? '')![1]);
  const all = await median();
  await expand(page, 'EV charger');
  for (const name of ['Clever', 'Norlys', 'OK', 'Spirii', 'EWII', 'E.ON', 'Circle K', 'Uno-X', 'Shell', 'Q8', 'Other providers']) {
    await row.getByRole('checkbox', { name, exact: true }).uncheck();
  }
  await expect(row.locator('.rule')).toHaveText('Tesla · Full points up to 500 m · No points from 3.0 km');
  // Tesla has three chargers in Aarhus Kommune, so far fewer homes are near one
  await expect.poll(median).toBeLessThan(all);
});

test('a requirement removes the cells that do not meet it', async ({ page }) => {
  await open(page);
  await page.locator('mat-chip', { hasText: 'Quiet' }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('option', { name: /Planning zone/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  const row = block(page, 'Planning zone');
  const required = row.getByRole('switch', { name: 'Required: Planning zone' });
  await expect(required).toBeChecked();
  await expect(result(page)).toHaveAttribute('aria-label', /meet your requirements/);
  const before = await cellsShown(page);
  await expand(page, 'Planning zone');
  await row.getByRole('checkbox', { name: 'Landzone' }).uncheck();
  await expect.poll(() => cellsShown(page)).toBeLessThan(before);
  await expect(row.locator('.rule')).toHaveText('Only Byzone');
  // Switched off, the requirement removes nothing, but keeps its settings
  const fewer = await cellsShown(page);
  await required.click();
  await expect.poll(() => cellsShown(page)).toBeGreaterThan(fewer);
  await expect(row.locator('.rule')).toHaveText('Only Byzone');
});

test('each map has its own blocks, and the maps are remembered', async ({ page }) => {
  await open(page);
  await page.locator('mat-chip', { hasText: 'Forest' }).click();
  await expect(block(page, 'Forest')).toBeVisible();
  await page.getByRole('button', { name: /^Map: My map/ }).click();
  await page.getByRole('menuitem', { name: 'New map' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Name of the map' }).fill('Near the sea');
  await page.getByRole('button', { name: 'Create' }).click();
  // A new map starts empty
  await expect(page.getByRole('button', { name: /^Map: Near the sea/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Where would you like to live?' })).toBeVisible();
  await expect(block(page, 'Forest')).toHaveCount(0);
  await page.locator('mat-chip', { hasText: 'Supermarket' }).click();
  await expect(block(page, 'Supermarket')).toBeVisible();

  await page.reload();
  await open(page);
  await expect(page.getByRole('button', { name: /^Map: Near the sea/ })).toBeVisible();
  await expect(block(page, 'Supermarket')).toBeVisible();
  await page.getByRole('button', { name: /^Map: / }).click();
  await page.getByRole('menuitemradio', { name: 'My map' }).click();
  await expect(block(page, 'Forest')).toBeVisible();
  await expect(block(page, 'Supermarket')).toHaveCount(0);
});

test('a group switches its blocks off together, and blocks move between groups', async ({ page }) => {
  await open(page);
  await page.locator('mat-chip', { hasText: 'Forest' }).click();
  await expect(result(page)).toHaveAttribute('aria-label', /median \d+/);
  const forest = await result(page).getAttribute('aria-label');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('option', { name: /^Quiet Noise/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(block(page, 'Quiet')).toBeVisible();
  // The map is drawn a moment later; wait until the result counts Quiet too
  await expect(result(page)).not.toHaveAttribute('aria-label', forest!);
  const both = await result(page).getAttribute('aria-label');
  await page.getByRole('switch', { name: 'Use Nature' }).click();
  await expect(result(page)).not.toHaveAttribute('aria-label', both!);
  await page.getByRole('switch', { name: 'Use Peace and quiet' }).click();
  await expect(page.getByRole('heading', { name: 'Everything is switched off' })).toBeVisible();
  await page.getByRole('switch', { name: 'Use Nature' }).click();
  await page.getByRole('switch', { name: 'Use Peace and quiet' }).click();
  await expect(result(page)).toHaveAttribute('aria-label', both!);

  const row = await expand(page, 'Quiet');
  await row.getByRole('button', { name: 'More for Quiet' }).click();
  await page.getByRole('menuitem', { name: 'Move to group' }).click();
  await page.getByRole('menuitem', { name: 'New group…' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Name of the group' }).fill('Evenings');
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Use Evenings' })).toBeVisible();
  // The group it left is empty, so it is gone
  await expect(page.getByRole('switch', { name: 'Use Peace and quiet' })).toHaveCount(0);
  await expect(result(page)).toHaveAttribute('aria-label', both!);
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

test('a map shared as a link opens in another browser with its blocks and view', async ({ browser, page }) => {
  await open(page);
  await page.locator('mat-chip', { hasText: 'Forest' }).click();
  await page.getByText('Map settings').click();
  await page.getByRole('combobox', { name: 'Heatmap colours' }).click();
  await page.getByRole('option', { name: /Azure/ }).click();
  await page.getByRole('button', { name: /^Map: / }).click();
  await page.getByRole('menuitem', { name: 'Share this map' }).click();
  const field = page.getByRole('textbox', { name: 'Link to the map' });
  await expect(field).toHaveValue(/#(map=[^&]+&)?share=[A-Za-z0-9_-]+$/);
  const link = await field.inputValue();

  // Someone else, with nothing of their own
  const other = await (await browser.newContext()).newPage();
  await other.goto(link);
  const dialog = other.getByRole('dialog');
  await expect(dialog).toContainText('Add the map “My map”?');
  await expect(dialog).toContainText('It has 1 block.');
  await dialog.getByRole('button', { name: 'Add map' }).click();
  await expect(other.getByRole('button', { name: /^Map: My map 2/ })).toBeVisible();
  await expect(other.locator('app-block-row .name')).toHaveText(['Forest']);
  await expect(other.locator('app-map-panel mat-panel-description')).toContainText('Azure');
  // The link is taken once: the address no longer holds it
  expect(other.url()).not.toContain('share=');
  await other.context().close();
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

test('two panels float over the map: the map above, the weighting below, and both hide together', async ({ page }) => {
  await open(page);
  const mapCard = page.getByRole('region', { name: 'The map' });
  const weighting = page.getByRole('region', { name: 'Your weighting' });
  const [top, below] = [(await mapCard.boundingBox())!, (await weighting.boundingBox())!];
  expect(top.x).toBe(12);
  expect(below.x).toBe(12);
  expect(below.y).toBeGreaterThanOrEqual(top.y + top.height + 12);
  await expect(mapCard.getByRole('radio', { name: 'Min. points' })).toHaveCount(0);
  await page.locator('mat-chip', { hasText: 'Forest' }).click();
  await expect(mapCard.getByRole('radio', { name: 'Min. points' })).toBeVisible();
  await expect(weighting.getByRole('button', { name: /^Map: / })).toBeVisible();

  await page.getByRole('button', { name: 'Hide panel' }).click();
  await expect(mapCard).toBeHidden();
  await expect(weighting).toBeHidden();
  const show = page.getByRole('button', { name: 'What matters to you' });
  await expect(show).toBeFocused();
  await show.click();
  await expect(weighting).toBeVisible();

  // Escape in them closes them too, but not when it closes a menu of theirs
  await page.getByRole('button', { name: 'Theme: System' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(weighting).toBeVisible();
  await weighting.getByRole('button', { name: /^Map: / }).focus();
  await page.keyboard.press('Escape');
  await expect(weighting).toBeHidden();
});

test('OpenStreetMap is credited on the map until the map is used, or for five seconds', async ({ page }) => {
  await open(page);
  // It may be gone already when the map loaded a while ago; either way it goes, and stays in the DOM
  const credit = page.locator('app-map-view a.credit');
  await expect(credit).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
  await expect(credit).toHaveText('© OpenStreetMap');
  await page.locator('.maplibregl-ctrl-zoom-in').click();
  await expect(credit).toHaveClass(/gone/);
  await expect(page.getByRole('link', { name: '© OpenStreetMap' })).toHaveCount(0);
});

test('the whole world is open to explore', async ({ page }) => {
  await open(page);
  await expect.poll(() => zoom(page)).toBeGreaterThan(5);
  // Out until the button gives up, which it does when the world fills the window. It may give up
  // while the last zoom still runs, after it said it was enabled, so it is clicked without waiting
  // to be enabled: a disabled button takes no click
  const zoomOut = page.locator('.maplibregl-ctrl-zoom-out');
  for (let i = 0; i < 12 && await zoomOut.isEnabled(); i++) {
    await zoomOut.click({ force: true });
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

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('the panel is a bottom sheet, which goes down while a place is dropped', async ({ page }) => {
    await open(page);
    // It starts down, with only its head over the map
    const handle = page.locator('app-bottom-sheet .handle');
    await expect(handle).toHaveAttribute('aria-expanded', 'false');
    await handle.tap();
    await expect(handle).toHaveAttribute('aria-expanded', 'true');
    await page.locator('mat-chip', { hasText: 'Forest' }).tap();
    await expect(block(page, 'Forest')).toBeVisible();
    await page.getByRole('button', { name: 'Add place' }).tap();
    await expect(page.locator('.placing-hint')).toContainText('Click or tap the map where the place is');
    await expect(handle).toHaveAttribute('aria-expanded', 'false');
    const map = (await page.locator('.maplibregl-canvas').boundingBox())!;
    await page.locator('.maplibregl-canvas').tap({ position: { x: map.width / 2, y: map.height / 3 } });
    // It comes back up with the new place's block
    await expect(handle).toHaveAttribute('aria-expanded', 'true');
    await expect(block(page, 'Place 1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  });

  test('the sheet follows its handle up, and settles near the top', async ({ page }) => {
    await open(page);
    const sheet = page.locator('app-bottom-sheet');
    const handle = (await page.locator('app-bottom-sheet .handle').boundingBox())!;
    const x = handle.x + handle.width / 2;
    await page.mouse.move(x, handle.y + handle.height / 2);
    await page.mouse.down();
    for (let y = handle.y; y > 40; y -= 60) await page.mouse.move(x, y, { steps: 3 });
    await page.mouse.up();
    // All the way up, with a strip of map left above it
    await expect.poll(async () => (await sheet.boundingBox())!.y).toBeLessThan(80);
    await expect(page.getByRole('heading', { name: 'Where would you like to live?' })).toBeVisible();
  });

  test('the data jobs fit the screen', async ({ page }) => {
    await open(page);
    await page.locator('app-bottom-sheet .handle').tap();
    await page.getByRole('button', { name: 'Data jobs' }).tap();
    const run = page.getByRole('button', { name: 'Run OpenStreetMap now' });
    await expect(run).toBeInViewport();
    const body = page.locator('app-jobs-dialog .body');
    expect(await body.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);
  });
});
