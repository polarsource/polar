import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    minify: true,
    dts: process.env.POLAR_SKIP_DTS === '1' ? false : { sourcemap: false },
    fixedExtension: false,
    deps: { dts: { neverBundle: true } },
  },
])
