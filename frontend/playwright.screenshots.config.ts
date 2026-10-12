import { defineConfig } from '@playwright/test';

const env = process.env;

/**
 * The screenshots in the README (docs/screenshots), taken of a running app with the data of all of
 * Denmark. BASE_URL says where it runs; the screenshots save nothing there (screenshots/readme.spec.ts).
 *
 *   BASE_URL=http://my-server:8080 npm run screenshots
 */
export default defineConfig({
  testDir: 'screenshots',
  timeout: 300_000,
  expect: { timeout: 120_000 },
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: env['BASE_URL'] ?? 'http://localhost:8080',
    channel: env['PLAYWRIGHT_CHANNEL'] ?? 'chrome',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    // Every request goes through the page, where the profile API is answered (see the spec)
    serviceWorkers: 'block',
  },
});
