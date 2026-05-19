import { defineConfig, Options } from 'tsup'

const allowedOriginsDefine = {
  __POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS__: `'${process.env.POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS ? process.env.POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS : 'http://127.0.0.1:3000'}'`,
}

export const options: Options[] = [
  {
    entry: {
      embed: 'src/checkout.ts',
      'payment-method': 'src/payment-method.ts',
      'react/payment-method': 'src/react/payment-method.tsx',
    },
    format: ['cjs', 'esm'],
    dts: true,
    minify: 'terser',
    define: allowedOriginsDefine,
    external: ['react'],
  },
  {
    entry: { embed: 'src/embed-global.ts' },
    format: ['iife'],
    minify: 'terser',
    define: allowedOriginsDefine,
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
