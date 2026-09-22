import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  use: {
    baseURL: 'http://127.0.0.1:5173/chyrongenerator/',
    viewport: { width: 1440, height: 960 },
    launchOptions: {
      executablePath: process.env.CHYRON_CHROMIUM_PATH || undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173/chyrongenerator/',
    reuseExistingServer: !process.env.CI,
  },
})
