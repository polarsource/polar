import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

const reactCompilerBabelPlugin = ['babel-plugin-react-compiler', {}]

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

const SERVER_TESTS = ['src/proxy.test.ts', 'src/utils/user.test.ts']

const env = {
  NEXT_PUBLIC_API_URL: 'http://api.polar.test',
  NEXT_PUBLIC_FRONTEND_BASE_URL: 'https://polar.sh',
  NEXT_PUBLIC_SANDBOX_FRONTEND_BASE_URL: 'https://sandbox.polar.sh',
}

const sharedTest = {
  environment: 'jsdom',
  setupFiles: ['./vitest.setup.ts'],
  fsModuleCache: true,
  isolate: false,
  sequence: { shuffle: { tests: true } },
  exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', ...SERVER_TESTS],
  env,
}

const serverProject = {
  plugins: [tsconfigPaths({ projects: ['tsconfig.json'] })],
  test: {
    name: 'server',
    environment: 'node',
    include: SERVER_TESTS,
    sequence: { shuffle: { tests: true } },
    env,
  },
}

const project = (name: string, compiled: boolean) => ({
  plugins: [
    tsconfigPaths({ projects: ['tsconfig.json'] }),
    react({
      babel: {
        plugins: compiled
          ? [reactCompilerBabelPlugin, stylexBabelPlugin]
          : [stylexBabelPlugin],
      },
    }),
  ],
  test: {
    ...sharedTest,
    name,
    ...(compiled
      ? { fsModuleCachePath: 'node_modules/.vitest-cache-compiled' }
      : {}),
  },
})

export default defineConfig({
  test: {
    sequence: { shuffle: { files: true } },
    projects: [
      project('uncompiled', false),
      project('compiled', true),
      serverProject,
    ],
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
