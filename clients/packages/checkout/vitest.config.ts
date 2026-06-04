import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Orbit's `@polar-sh/orbit` entry resolves to raw TS source that calls
// `stylex.defineVars` at module load. Without the StyleX babel plugin those
// calls throw ("Styles must be compiled by '@stylexjs/babel-plugin'"), which
// breaks any test that imports an Orbit component. Mirror apps/web/babel.config.js.
const orbitRoot = fileURLToPath(new URL('../orbit', import.meta.url))

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          [
            '@stylexjs/babel-plugin',
            {
              dev: process.env.NODE_ENV !== 'production',
              runtimeInjection: false,
              treeshakeCompensation: true,
              unstable_moduleResolution: {
                type: 'commonJS',
                rootDir: orbitRoot,
              },
            },
          ],
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
})
