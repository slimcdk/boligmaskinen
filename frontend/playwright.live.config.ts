import { defineConfig } from '@playwright/test';

const env = process.env;

/**
 * End-to-end tests against the whole app: the frontend, the backend and its database, such as the
 * image started with compose.yaml, which CI does. BASE_URL says where it runs. Unlike the tests in
 * e2e/, these start no server of their own.
 */
export default defineConfig({
  testDir: 'e2e-live',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  workers: 1,
  forbidOnly: !!env['CI'],
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-live' }]],
  use: {
    baseURL: env['BASE_URL'] ?? 'http://localhost:8080',
    channel: env['PLAYWRIGHT_CHANNEL'] ?? 'chrome',
    viewport: { width: 1440, height: 900 },
    // The app speaks the browser's language; the tests read English unless they ask for Danish
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: env['CI'] || env['PLAYWRIGHT_SOFTWARE_GL'] === '1' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
    },
  },
});
