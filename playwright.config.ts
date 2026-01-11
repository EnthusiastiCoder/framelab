import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// e2e tests run against the real build served by scripts/serve-dist.mjs, which applies dist/_headers.
// BASE_URL points the suite at a live deploy (WS6 @smoke) and skips the local server.
const PORT = Number(process.env.PORT ?? 4799);
// Not 4173: that is the Vite preview default and another local project (JEE Quest) already listens there,
// which reuseExistingServer would silently reuse.
const BASE_URL = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;

// Until WS1 lands scripts/serve-dist.mjs there is no app to serve; tests then fail on navigation
// (connection refused) instead of the whole run aborting on a missing build script.
const canServe = !process.env.BASE_URL && existsSync('scripts/serve-dist.mjs');

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  projects: [
    // Primary: Edge has the proprietary H.264/AAC codecs. Runs everything.
    { name: 'msedge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    // Bundled Chromium (no H.264/AAC) and Firefox: only the cross-browser cases.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, grep: /@cross/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grep: /@cross/ },
    // WebKit: smoke only (pages, headers, capability banner).
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grep: /@smoke|@webkit/ },
  ],
  webServer: canServe
    ? {
        command: 'npm run build && node scripts/serve-dist.mjs',
        url: BASE_URL,
        env: { PORT: String(PORT) },
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
      }
    : undefined,
});
