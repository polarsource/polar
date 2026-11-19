import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const sharedTest = {
  environment: 'jsdom',
  setupFiles: ['./vitest.setup.ts'],
  fsModuleCache: true,
  isolate: false,
  sequence: { shuffle: { tests: true } },
  env: {
    TZ: 'UTC',
  },
} as const

export default defineConfig({
  test: {
    sequence: { shuffle: { files: true } },
    projects: [
      {
        plugins: [react()],
        test: { ...sharedTest, name: 'uncompiled' },
      },
      {
        plugins: [
          react({ babel: { plugins: [['babel-plugin-react-compiler', {}]] } }),
        ],
        test: {
          ...sharedTest,
          name: 'compiled',
          fsModuleCachePath: 'node_modules/.vitest-cache-compiled',
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test-utils/**'],
      reporter: ['text-summary'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 70,
      },
    },
  },
})
