import { nextJsConfig } from '@polar-sh/eslint-config/next-js'

// Elements replaced by Orbit primitives — ban raw JSX usage as a warning.
const orbitElementRule = (element, replacement) => ({
  selector: `JSXOpeningElement[name.name="${element}"]`,
  message: `Use ${replacement} from @polar-sh/orbit instead of <${element}>.`,
})

/** @type {import("eslint").Linter.Config} */
export default [
  ...nextJsConfig,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXOpeningElement[name.name="img"]',
          message:
            'Use <UploadImage /> from @/components/Image/Image or <StaticImage /> from @/components/Image/StaticImage instead of <img>.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/image',
              message:
                'Use <StaticImage /> from @/components/Image/StaticImage instead of next/image.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
  },
  // Orbit primitive enforcement — warn when raw HTML elements are used
  // that should be expressed through Box, Text, or Headline.
  {
    files: ['**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        // Stack replaces flex divs
        {
          selector: `JSXOpeningElement[name.name="div"]:has(JSXAttribute[name.name="className"][value.value=/\\bflex\\b/])`,
          message: 'Use <Stack> from @polar-sh/orbit instead of <div className="flex ...">. Stack is always display:flex and accepts alignItems, justifyContent, gap, and other layout props directly.',
        },
        // Headline replaces headings
        orbitElementRule('h1', '<Headline as="h1">'),
        orbitElementRule('h2', '<Headline as="h2">'),
        orbitElementRule('h3', '<Headline as="h3">'),
        orbitElementRule('h4', '<Headline as="h4">'),
        orbitElementRule('h5', '<Headline as="h5">'),
        orbitElementRule('h6', '<Headline as="h6">'),
        // Text replaces inline and block text elements
        orbitElementRule('p', '<Text>'),
        orbitElementRule('span', '<Text as="span">'),
        orbitElementRule('strong', '<Text as="strong">'),
        orbitElementRule('em', '<Text as="em">'),
        orbitElementRule('small', '<Text as="small">'),
        orbitElementRule('label', '<Text as="label">'),
        orbitElementRule('code', '<Text as="code">'),
      ],
    },
  },
]
