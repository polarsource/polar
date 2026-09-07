import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

const stylexBabelPlugin = [
  '@stylexjs/babel-plugin',
  {
    dev: true,
    runtimeInjection: false,
    treeshakeCompensation: true,
    unstable_moduleResolution: { type: 'commonJS', rootDir: __dirname },
  },
]

const CHECKOUT_FILES = [
  'src/components/Checkout/**',
  'src/hooks/checkout.ts',
  'src/utils/checkout.ts',
]

export default defineConfig({
  plugins: [
    tsconfigPaths({ projects: ['tsconfig.json'] }),
    react({ babel: { plugins: [stylexBabelPlugin] } }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    fsModuleCache: true,
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    env: {
      NEXT_PUBLIC_API_URL: 'http://api.polar.test',
      NEXT_PUBLIC_FRONTEND_BASE_URL: 'https://polar.sh',
      NEXT_PUBLIC_SANDBOX_FRONTEND_BASE_URL: 'https://sandbox.polar.sh',
    },
    coverage: {
      provider: 'v8',
      include: CHECKOUT_FILES,
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
