import { defineConfig, devices } from '@playwright/test'
import {
  hasDevDockerInstance,
  loadEnvLocal,
  storageStatePath,
  webURL,
} from './e2e/support/env'

loadEnvLocal(__dirname)

const jsonOutput = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  globalSetup: './e2e/global-setup.ts',
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ...(jsonOutput
      ? [['json', { outputFile: jsonOutput }] as [string, object]]
      : []),
  ],
  use: {
    baseURL: webURL,
    // Only reuse the admin session when global setup minted it (dev-docker run).
    storageState: hasDevDockerInstance ? storageStatePath : undefined,
    trace: 'retain-on-failure',
    // E2E_SCREENSHOTS=1 (dev e2e --screenshots) captures every test, not just failures.
    screenshot: process.env.E2E_SCREENSHOTS ? 'on' : 'only-on-failure',
    video: process.env.E2E_SCREENSHOTS ? 'on' : 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
