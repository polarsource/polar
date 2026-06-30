import { nextJsConfig } from '@polar-sh/eslint-config/next-js'
import polarPlugin from './eslint-rules/index.mjs'

/** @type {import("eslint").Linter.Config} */
export default [
  ...nextJsConfig,
  {
    plugins: {
      polar: polarPlugin,
    },
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'vitest.config.ts',
            'playwright.config.ts',
            '*.config.mjs',
            'instrumentation-client.ts',
          ],
        },
      },
    },
  },
  {
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'polar/no-toast-error-detail': 'error',
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      'react/no-danger': 'error',
      'react/self-closing-comp': 'warn',
      'react/jsx-no-useless-fragment': 'warn',
      'polar/no-classname-box': 'error',
      'polar/no-classname-text': 'error',
      'polar/no-style-box': 'error',
      'polar/no-style-text': 'error',
      'polar/no-next-image': 'error',
      'polar/no-external-link-component': 'error',
      'polar/require-external-link-rel': 'error',
    },
  },
  {
    files: [
      'src/components/CustomerPortal/**/*.{ts,tsx}',
      'src/app/**/portal/**/*.{ts,tsx}',
    ],
    rules: {
      'polar/no-merchant-queries-in-customer-portal': 'error',
      'polar/no-merchant-api-calls-in-customer-portal': 'error',
    },
  },
  {
    files: ['src/app/**/portal/**/page.tsx'],
    ignores: [
      'src/app/**/portal/page.tsx',
      'src/app/**/portal/request/page.tsx',
      'src/app/**/portal/authenticate/page.tsx',
      'src/app/**/portal/verify-email/page.tsx',
      'src/app/**/portal/claim/page.tsx',
    ],
    rules: {
      'polar/require-customer-portal-page': 'error',
    },
  },
  {
    files: [
      'src/app/(main)/onboarding/**/*.tsx',
      'src/components/Onboarding/**/*.tsx',
    ],
    rules: {
      'polar/no-raw-html-layout': 'error',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
      'eslint-rules/**',
      'src/app/.well-known/**',
      'next-env.d.ts',
      'e2e/**',
      'playwright-report/**',
      'babel.config.js',
      'scripts/**',
    ],
  },
]
