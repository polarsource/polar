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
            'To ensure we are consistent in our email designs, avoid className in email templates. Use a pre-existing component from src/components/layout or src/components/text if possible.',
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
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react-email', 'react-email/*'],
              message:
                'Do not import react-email in email templates. Compose them from src/components/layout and src/components/text instead.',
            },
          ],
        },
      ],
    },
  },
)
