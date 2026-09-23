import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vitest/config'

const localEnv = join(__dirname, '.env.local')
if (existsSync(localEnv)) process.loadEnvFile(localEnv)

export default defineConfig({
  test: {
    include: ['e2e/**/*.test.ts'],
    reporters: [
      'default',
      ['json', { outputFile: 'e2e/artifacts/results.json' }],
    ],
    environment: 'node',
    fileParallelism: false,
    retry: 2,
    testTimeout: 300_000,
    hookTimeout: 120_000,
    expect: { poll: { timeout: 120_000, interval: 2_000 } },
  },
})
