import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const envFile = resolve(__dirname, '.env.local')
try {
  const content = readFileSync(envFile, 'utf-8')
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*"?(.*?)"?\s*$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2]
    }
  }
} catch {
  // ignore
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
