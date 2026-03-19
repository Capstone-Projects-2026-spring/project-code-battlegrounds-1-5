import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Look for test files in the "tests" directory, relative to this configuration file.
  testDir: 'tests/pw',

  // 2 min per test
  timeout: 120000,

  // Run all tests in parallel.
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,

  // Retry on CI only.
  retries: 0, // process.env.CI ? 2 : 0,

  // Try with 3 workers out of parallel tests on CI.
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [['html'], ['list']],

  use: {
    // Base URL to use in actions like `await page.goto('/')`.
    baseURL: 'http://localhost:3000',

    screenshot: 'only-on-failure',

    // Collect trace when retrying the failed test.
    trace: 'on-first-retry',
  },
  // Configure projects for major browsers.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // May not need to start a web server if you run the tests with the dev server already running.
  // Run your local dev server before starting the tests.
  //webServer: {
  //  command: 'npm run dev',
  //  url: 'http://localhost:3000',
  //  reuseExistingServer: !process.env.CI,
  //},
});