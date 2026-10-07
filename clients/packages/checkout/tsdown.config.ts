import { defineConfig, type UserConfig } from 'tsdown'

const allowedOriginsDefine = {
  __POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS__: `'${process.env.POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS ? process.env.POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS : 'http://127.0.0.1:3000'}'`,
}

export const options: UserConfig[] = [
  {
    entry: {
      embed: 'src/checkout.ts',
      'payment-method': 'src/payment-method.ts',
      'react/payment-method': 'src/react/payment-method.tsx',
    },
    format: ['cjs', 'esm'],
    dts: process.env.POLAR_SKIP_DTS === '1' ? false : { sourcemap: false },
    fixedExtension: false,
    minify: true,
    define: allowedOriginsDefine,
    deps: { dts: { neverBundle: true } },
  },
  {
    entry: { embed: 'src/embed-global.ts' },
    format: ['iife'],
    outputOptions: { entryFileNames: '[name].global.js' },
    minify: true,
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
    platform: 'browser',
    inputOptions: (options, format, { cjsDts }) => {
      if (format !== 'cjs' || cjsDts) return
      return { ...options, platform: 'browser' }
    },
    minify: true,
    dts: process.env.POLAR_SKIP_DTS === '1' ? false : { sourcemap: false },
    fixedExtension: false,
    deps: { dts: { neverBundle: true } },
  },
]

export default defineConfig(options)
