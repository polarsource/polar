import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['cjs'],
  clean: false,
  dts: false,
  target: false,
  fixedExtension: false,
  deps: { alwaysBundle: [/./] },
})
