import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  fixedExtension: false,
  deps: { dts: { neverBundle: true } },
})
