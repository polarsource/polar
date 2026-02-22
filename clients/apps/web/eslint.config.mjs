import { nextJsConfig } from '@polar-sh/eslint-config/next-js'

// Elements replaced by Orbit primitives — ban raw JSX usage as a warning.
const orbitElementRule = (element, replacement) => ({
  selector: `JSXOpeningElement[name.name="${element}"]`,
  message: `Use ${replacement} from @/components/Orbit instead of <${element}>.`,
})

/** @type {import("eslint").Linter.Config} */
export default [
  ...nextJsConfig,
  // Other configurations
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
        // Box replaces layout divs
        orbitElementRule('div', '<Box>'),
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
