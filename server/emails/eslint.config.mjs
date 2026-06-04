import tseslint from 'typescript-eslint'

const emailDesignSystem = {
  rules: {
    'no-classname': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Disallow className in email templates so all styling lives in shared components',
        },
        schema: [],
        messages: {
          noClassName:
            'To ensure we are consistent in our email designs, avoid className in email templates. Use a pre-existing component from src/components/foundation if possible.',
        },
      },
      create(context) {
        return {
          JSXAttribute(node) {
            if (node.name && node.name.name === 'className') {
              context.report({ node, messageId: 'noClassName' })
            }
          },
        }
      },
    },
    'no-raw-text-elements': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Disallow raw text JSX elements; use the design-system <Text>/<Heading>/<Link> components instead',
        },
        schema: [],
        messages: {
          noRawText:
            'Use the design-system <Text> (or <Heading>/<Link>) instead of a raw <{{name}}> element.',
        },
      },
      create(context) {
        const banned = new Set([
          'p',
          'span',
          'a',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'strong',
          'em',
          'b',
          'i',
          'small',
        ])
        return {
          JSXOpeningElement(node) {
            const name = node.name
            if (
              name &&
              name.type === 'JSXIdentifier' &&
              banned.has(name.name)
            ) {
              context.report({
                node,
                messageId: 'noRawText',
                data: { name: name.name },
              })
            }
          },
        }
      },
    },
  },
}

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'bin/**',
      '.turbo/**',
      'src/types/openapi.ts',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },
  {
    files: ['src/emails/**/*.tsx'],
    plugins: { 'email-ds': emailDesignSystem },
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      'email-ds/no-classname': 'error',
      'email-ds/no-raw-text-elements': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react-email', 'react-email/*'],
              message:
                'Do not import react-email in email templates. Compose them from src/components/foundation instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/**/*.{ts,tsx}'],
    plugins: { 'email-ds': emailDesignSystem },
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      'email-ds/no-raw-text-elements': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-email',
              importNames: ['Text'],
              message:
                "Do not use react-email's <Text> in components. Use the design-system <Text> from src/components/foundation instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/foundation/Text.tsx'],
    rules: {
      'no-restricted-imports': 'off',
      'email-ds/no-raw-text-elements': 'off',
    },
  },
)
