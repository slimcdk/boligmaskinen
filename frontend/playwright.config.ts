import { defineConfig } from '@playwright/test';

const PORT = 4310;
const env = process.env;

/**
 * End-to-end tests in a real browser against the dev server. The server runs the "e2e"
 * configuration, which serves the small test data pack in e2e/data-pack (Aarhus Kommune) instead
 * of public/data-pack, so the tests give the same results everywhere.
 *
 * They use the installed Google Chrome, so no browser download is needed. The dev container sets
 * PLAYWRIGHT_CHANNEL=chromium for Playwright's own Chromium, and PLAYWRIGHT_SOFTWARE_GL=1 because it
 * has no GPU; CI runners have none either.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  // Every test loads the whole data pack; two at a time keeps the machine responsive
  workers: 2,
  fullyParallel: true,
  forbidOnly: !!env['CI'],
  retries: env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: env['PLAYWRIGHT_CHANNEL'] ?? 'chrome',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Without a GPU the map's WebGL is drawn in software by SwiftShader
    launchOptions: {
      args: env['CI'] || env['PLAYWRIGHT_SOFTWARE_GL'] === '1' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
    },
  },
  webServer: {
    command: `npm start -- --configuration e2e --port ${PORT} --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !env['CI'],
    timeout: 180_000,
  },
});
