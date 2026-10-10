import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

/** WCAG 2.2 A and AA, as milestone 7 asks. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function open(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('mat-progress-bar')).toHaveCount(0, { timeout: 60_000 });
}

/** What axe finds, one line per element, so a failure says where. */
async function problems(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.flatMap((v) => v.nodes.map((n) => `${v.id} (${v.impact}): ${n.target.join(' ')} — ${n.failureSummary?.split('\n')[1]?.trim() ?? v.help}`));
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`in ${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test('the map and the panels meet WCAG 2.2 AA', async ({ page }) => {
      await open(page);
      expect(await problems(page)).toEqual([]);
      await page.locator('mat-chip', { hasText: 'Forest' }).click();
      await page.locator('app-block-row').first().getByRole('button', { name: /Show settings/ }).click();
      expect(await problems(page)).toEqual([]);
    });

    test('the dialogs meet WCAG 2.2 AA', async ({ page }) => {
      await open(page);
      await page.locator('mat-chip', { hasText: 'Forest' }).click();
      const row = page.locator('app-block-row').first();
      await row.getByRole('button', { name: /Show settings/ }).click();
      await row.getByRole('button', { name: 'Code' }).click();
      await expect(page.getByRole('textbox', { name: 'Code' })).toBeVisible();
      expect(await problems(page)).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.getByRole('button', { name: 'About the data' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await problems(page)).toEqual([]);
      await page.keyboard.press('Escape');
      // The catalogue, whose notes wrap onto a second line
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      const option = page.getByRole('option', { name: /^Away from airfields/ });
      await expect(option).toContainText('Nearest airfield of any kind, down to gliding and microlight fields, from OpenStreetMap.');
      expect(await problems(page)).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.getByRole('button', { name: 'Data jobs' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await problems(page)).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.getByRole('button', { name: /^Map: / }).click();
      await page.getByRole('menuitem', { name: 'Share this map' }).click();
      await expect(page.getByRole('textbox', { name: 'Link to the map' })).toBeVisible();
      expect(await problems(page)).toEqual([]);
    });
  });
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('the map and the bottom sheet meet WCAG 2.2 AA', async ({ page }) => {
    await open(page);
    expect(await problems(page)).toEqual([]);
  });
});
