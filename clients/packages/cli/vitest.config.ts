import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    setupFiles: ['./src/utils/test-utils/setup.ts'],
    coverage: {
      provider: 'istanbul',
      include: ['src/**/*.ts', 'scripts/**/*.js'],
      exclude: [
        'src/**/*.test.ts',
        'scripts/**/*.test.ts',
        'src/utils/test-utils/**',
        'src/schemas/**',
        'src/cli.ts',
      ],
      reporter: ['text-summary'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
})
