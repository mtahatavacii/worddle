// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// CHROME_PATH lets you run against an installed Chrome instead of
// Playwright's bundled browser (e.g. CHROME_PATH=/usr/bin/google-chrome).
const chromeLaunch = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};

module.exports = defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.js/,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: chromeLaunch },
    },
    {
      // Same engine as Safari and every browser on iPhone.
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: /(mobile|storage)\.spec\.js/,
    },
  ],
});
