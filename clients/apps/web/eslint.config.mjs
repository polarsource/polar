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
    },
  },
  {
    files: [
      'src/components/CustomerPortal/**/*.{ts,tsx}',
      'src/app/(main)/[organization]/portal/**/*.{ts,tsx}',
    ],
    rules: {
      'polar/no-merchant-queries-in-customer-portal': 'error',
      'polar/no-merchant-api-calls-in-customer-portal': 'error',
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
    ],
  },
]

// Orbit primitive enforcement — warn when raw HTML elements are used
// that should be expressed through Stack, Text, or Headline.
// {
//   files: ['**/*.tsx'],
//   rules: {
//     'no-restricted-syntax': [
//       'warn',
//       // Stack replaces flex divs
//       {
//         selector: `JSXOpeningElement[name.name="div"]:has(JSXAttribute[name.name="className"][value.value=/\\bflex\\b/])`,
//         message: 'Use <Stack> from @polar-sh/orbit instead of <div className="flex ...">. Stack is always display:flex and accepts alignItems, justifyContent, gap, and other layout props directly.',
//       },
//       // Headline replaces headings
//       orbitElementRule('h1', '<Headline as="h1">'),
//       orbitElementRule('h2', '<Headline as="h2">'),
//       orbitElementRule('h3', '<Headline as="h3">'),
//       orbitElementRule('h4', '<Headline as="h4">'),
//       orbitElementRule('h5', '<Headline as="h5">'),
//       orbitElementRule('h6', '<Headline as="h6">'),
//       // Text replaces inline and block text elements
//       orbitElementRule('p', '<Text>'),
//       orbitElementRule('span', '<Text as="span">'),
//       orbitElementRule('strong', '<Text as="strong">'),
//       orbitElementRule('em', '<Text as="em">'),
//       orbitElementRule('small', '<Text as="small">'),
//       orbitElementRule('label', '<Text as="label">'),
//       orbitElementRule('code', '<Text as="code">'),

//       // ── <Text> className guards ──────────────────────────────────────────
//       // These props have dedicated counterparts — never express them via className.

//       // Font size → use variant
//       textClassRule(
//         '\\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\\b',
//         'Do not set font size on <Text> via className. Choose a variant (body, label, caption, subtle, disabled, mono) instead.',
//       ),
//       // Text color → use color prop or variant
//       textClassRule(
//         '\\btext-(?:inherit|current|transparent|white|black|[a-z]+-\\d+)\\b',
//         'Do not set text color on <Text> via className. Use the color prop (error/warning/success) or a different variant instead.',
//       ),
//       // Text alignment → use align prop
//       textClassRule(
//         '\\btext-(?:left|center|right|justify)\\b',
//         'Do not set text alignment on <Text> via className. Use the align prop instead.',
//       ),
//       // Font weight → use variant
//       textClassRule(
//         '\\bfont-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\\b',
//         'Do not set font weight on <Text> via className. Choose a variant instead.',
//       ),
//       // Letter spacing → use variant
//       textClassRule(
//         '\\btracking-(?:tighter|tight|normal|wide|wider|widest)\\b',
//         'Do not set letter-spacing on <Text> via className. Choose a variant instead.',
//       ),
//       // Line height → use variant or wrap
//       textClassRule(
//         '\\bleading-(?:none|tight|snug|normal|relaxed|loose)\\b',
//         'Do not set line-height on <Text> via className. Choose a variant instead.',
//       ),
//     ],
//   },
// },
