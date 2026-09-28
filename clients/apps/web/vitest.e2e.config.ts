import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vitest/config'

const localEnv = join(__dirname, '.env.local')
if (existsSync(localEnv)) process.loadEnvFile(localEnv)

export default defineConfig({
  test: {
    include: ['e2e/**/*.test.ts'],
    globalSetup: ['e2e/utils/global-setup.ts'],
    reporters: [
      'default',
      ['json', { outputFile: 'e2e/artifacts/results.json' }],
    ],
    environment: 'node',
    maxWorkers: process.env.CI ? 1 : 4,
    retry: process.env.CI ? 2 : 0,
    allowOnly: !process.env.CI,
    testTimeout: 180_000,
    hookTimeout: 120_000,
    expect: { poll: { timeout: 60_000, interval: 2_000 } },
  },
})
