import { defineConfig, Options } from 'tsup'

export const options: Options = {
  entry: ['./src', '!./src/**/*.stories.*'],
  format: ['cjs', 'esm'],
  minify: true,
  dts: true,
  bundle: true,
}

export default defineConfig(options)
