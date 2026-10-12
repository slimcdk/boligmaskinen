import { type Browser, expect, type Page, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { blockFrom, DEFAULT_VIEW, emptyMap, groupNameFor, inGroup, LIBRARY, type SavedMap, type ViewState } from '../../packages/engine/src/index.ts';

/**
 * The screenshots in the README, taken of a running app with the data of all of Denmark
 * (playwright.screenshots.config.ts says where), into docs/screenshots as WebP.
 *
 * The map comes in as a link to a map (#share=, src/app/state/share.ts), and the profile API
 * answers as a server without a database, so the app keeps its maps in this browser: the maps and
 * places of the app's own users are neither read nor changed.
 */

const OUT = resolve(__dirname, '../../docs/screenshots');

/** The map in the README: a family that wants nature and quiet, with everyday life close by. */
function familyMap(name: string): SavedMap {
  let map = emptyMap(name);
  for (const id of ['forest', 'water', 'noise', 'elevation', 'school', 'daycare', 'supermarket', 'station', 'charger']) {
    const template = LIBRARY.find((t) => t.id === id);
    if (!template) throw new Error(`There is no predefined block ${id}`);
    const grouped = inGroup(map, blockFrom(template), groupNameFor(template));
    map = { ...grouped.map, blocks: [...grouped.map.blocks, grouped.block] };
  }
  return map;
}

/** The code of a link to the map, as share.ts makes it. */
function shareCode(map: SavedMap, view: Partial<ViewState>): string {
  const shared = { v: 1, name: map.name, blocks: map.blocks, groups: map.groups, places: [], view: { ...DEFAULT_VIEW, ...view } };
  return deflateRawSync(Buffer.from(JSON.stringify(shared))).toString('base64url');
}

interface Camera {
  zoom: number;
  lat: number;
  lng: number;
}

/** Aarhus, Silkeborg, Randers and Horsens, right of the panel. */
const EAST_JUTLAND: Camera = { zoom: 9, lat: 56.15, lng: 9.81 };
/** All of Denmark, right of the panel. */
const DENMARK: Camera = { zoom: 6.65, lat: 56.17, lng: 10.4 };
/** Aarhus on a phone, between the map's card and the panel. */
const AARHUS: Camera = { zoom: 10.2, lat: 56.11, lng: 10.17 };

/** Open the app at the camera with the map added from its link, and wait until the map is drawn. */
async function open(page: Page, camera: Camera, map: SavedMap, view: Partial<ViewState> = {}): Promise<void> {
  await page.route('**/api/profile**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'No database' }) }));
  await page.goto(`/#map=${camera.zoom}/${camera.lat}/${camera.lng}&share=${shareCode(map, view)}`);
  const danish = (await page.evaluate(() => navigator.language)).startsWith('da');
  await page.getByRole('button', { name: danish ? 'Tilføj kort' : 'Add map' }).click();
  await expect(page.locator('mat-progress-bar')).toHaveCount(0);
  await expect(page.locator('app-map-panel app-histogram canvas')).toHaveAttribute('aria-label', /\d/);
  await settle(page);
}

/** Wait until the map has loaded what it shows and drawn it, and the dialogs have opened. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
}

/** The page as WebP, which Chrome makes from the screenshot: a fifth of the PNG, as sharp to the eye. */
async function save(page: Page, browser: Browser, name: string): Promise<void> {
  const png = await page.screenshot();
  const encoder = await browser.newPage();
  const webp = await encoder.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d')!.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), 'image/webp', 0.9));
    const url = await new Promise<string>((done) => {
      const reader = new FileReader();
      reader.onload = () => done(reader.result as string);
      reader.readAsDataURL(blob);
    });
    return url.slice(url.indexOf(',') + 1);
  }, png.toString('base64'));
  await encoder.close();
  writeFileSync(`${OUT}/${name}.webp`, Buffer.from(webp, 'base64'));
}

test('the map', async ({ page, browser }) => {
  await open(page, EAST_JUTLAND, familyMap('A family near Aarhus'));
  await save(page, browser, 'map');
});

test("a block's settings and its code", async ({ page, browser }) => {
  await open(page, EAST_JUTLAND, familyMap('A family near Aarhus'));
  await page.getByRole('button', { name: 'Show settings for EV charger' }).click();
  await page.waitForTimeout(800);
  await save(page, browser, 'block');
  await page.locator('app-block-row').filter({ hasText: 'EV charger' }).getByRole('button', { name: 'Code' }).click();
  await settle(page);
  await save(page, browser, 'code');
});

test('what matters to you', async ({ page, browser }) => {
  await open(page, EAST_JUTLAND, familyMap('A family near Aarhus'));
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await settle(page);
  // The dialog puts the focus on its first choice, which would show as picked out
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await save(page, browser, 'catalogue');
});

test('the data jobs', async ({ page, browser }) => {
  await open(page, EAST_JUTLAND, familyMap('A family near Aarhus'));
  await page.getByRole('button', { name: 'Data jobs' }).click();
  await settle(page);
  await save(page, browser, 'jobs');
});

test.describe('in dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('all of Denmark', async ({ page, browser }) => {
    await open(page, DENMARK, familyMap('A family near Aarhus'));
    await save(page, browser, 'denmark');
  });
});

test.describe('on a phone, in Danish', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'da-DK' });

  test('the map', async ({ page, browser }) => {
    await open(page, AARHUS, familyMap('Familie nær Aarhus'));
    // Half the panel, so its blocks show under the map
    await page.getByRole('button', { name: 'Vis panelet' }).tap();
    await settle(page);
    await save(page, browser, 'phone');
  });
});
