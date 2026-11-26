import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/runtime.ts'],
  format: ['esm', 'cjs'],
  dts: { sourcemap: false },
  fixedExtension: false,
  deps: { dts: { neverBundle: true } },
})
