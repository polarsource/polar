import { defineConfig, Options } from 'tsup'

export const options: Options[] = [
  {
    entry: ['src/embed.ts'],
    format: ['cjs', 'esm', 'iife'],
    dts: true,
    minify: 'terser',
    define: {
      // @ts-ignore
      __POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS__: `'${process.env.POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS ? process.env.POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS : 'http://127.0.0.1:3000'}'`,
    },
  },
  {
    entry: [
      'src/guards.ts',
      'src/components/index.ts',
      'src/hooks/index.ts',
      'src/providers/index.ts',
    ],
    format: ['cjs', 'esm'],
    minify: true,
    dts: true,
  },
]

export default defineConfig(options)
