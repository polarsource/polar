import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/strategies/*/index.ts',
    'src/opentelemetry/index.ts',
  ],
  format: ['esm', 'cjs'],
  dts: { sourcemap: false },
  fixedExtension: false,
  deps: { dts: { neverBundle: true } },
})
