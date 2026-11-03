import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'cloudflare:workers': new URL('./test/workers.ts', import.meta.url)
        .pathname,
    },
  },
  test: { environment: 'node', restoreMocks: true },
})
