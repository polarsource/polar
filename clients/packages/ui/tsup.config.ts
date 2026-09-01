import { defineConfig, Options } from 'tsup'

export const options: Options = {
  entry: ['./src', '!./src/**/*.stories.*'],
  format: ['cjs', 'esm'],
  minify: true,
  dts: process.env.POLAR_SKIP_DTS !== '1',
  bundle: true,
}

export default defineConfig(options)
