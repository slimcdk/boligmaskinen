import { expect, test } from '@playwright/test';

test('the app\'s own fonts load: Roboto, and the variable icon font whose strokes follow the size', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 60_000 });
  await page.evaluate(async () => { await document.fonts.ready; });
  const faces = await page.evaluate(() => [...document.fonts].map((f) => ({ family: f.family.replace(/"/g, ''), weight: f.weight, status: f.status })));
  // A static instance of the icons, of weight 400 alone, is drawn for 48 px and looks thin at 24
  expect(faces.filter((f) => f.family === 'Material Symbols Outlined')).toEqual([{ family: 'Material Symbols Outlined', weight: '100 700', status: 'loaded' }]);
  expect(faces).toContainEqual({ family: 'Roboto', weight: '400', status: 'loaded' });
});
