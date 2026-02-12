import { defineConfig, Options } from 'tsup'

export const options: Options[] = [
  {
    entry: ['src/index.ts', 'src/formatters/date.ts'],
    format: ['cjs', 'esm'],
    minify: true,
    dts: true,
  },
]

export default defineConfig(options)
