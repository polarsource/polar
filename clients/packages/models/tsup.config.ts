import { defineConfig, Options } from 'tsup'

export const options: Options[] = [
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm', 'iife'],
    dts: true,
    minify: 'terser',
 
  }
]

export default defineConfig(options)
