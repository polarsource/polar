import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: 'esm',
  outDir: 'bin',
  clean: false,
  dts: false,
  target: false,
  fixedExtension: false,
  deps: {
    alwaysBundle: ['@polar-sh/cli-commands'],
  },
})
