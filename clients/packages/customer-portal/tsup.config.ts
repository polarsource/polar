import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: {
      'core/index': 'src/core/index.ts',
      'react/index': 'src/react/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ['react', '@tanstack/react-query'],
  },
])
