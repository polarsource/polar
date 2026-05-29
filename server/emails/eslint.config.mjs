import tseslint from 'typescript-eslint'

const emailDesignSystem = {
  rules: {
    'no-inline-styling': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Disallow className/style props in email templates; use shared components instead.',
        },
        messages: {
          banned:
            "`{{attr}}` is not allowed in email templates. Build the email by composing shared components from '../components' — all styling lives there, never inline.",
        },
        schema: [],
      },
      create(context) {
        return {
          JSXAttribute(node) {
            const name = node.name && node.name.name
            if (name === 'className' || name === 'style') {
              context.report({ node, messageId: 'banned', data: { attr: name } })
            }
          },
        }
      },
    },
  },
}

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'bin/**', '.turbo/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
  },
  {
    files: ['src/emails/**/*.tsx'],
    plugins: {
      'email-ds': emailDesignSystem,
    },
    rules: {
      'email-ds/no-inline-styling': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react-email', '@react-email/*'],
              message:
                "Email templates must not import react-email primitives directly. Compose the email from shared components in '../components' — wrap any missing primitive there first.",
            },
          ],
        },
      ],
    },
  },
]
