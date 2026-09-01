import { defineConfig, Options } from 'tsup'

export const options: Options[] = [
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    minify: true,
    dts: process.env.POLAR_SKIP_DTS !== '1',
  },
]

export default defineConfig(options)
