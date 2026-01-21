import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/messages.ts', 'src/server.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['react', 'next-intl'],
})
