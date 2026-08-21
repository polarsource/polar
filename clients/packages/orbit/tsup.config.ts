import { defineConfig, type Options } from 'tsup'

export const options: Options = {
  entry: ['./src/index.ts', './src/tokens/tokens.stylex.ts'],
  format: ['cjs', 'esm'],
  minify: true,
  dts: process.env.POLAR_SKIP_DTS !== '1',
  bundle: true,
  external: ['react', 'react-dom'],
}

export default defineConfig(options)
