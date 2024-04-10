module.exports = {
  extends: ['next', 'turbo', 'prettier', 'next/core-web-vitals'],
  ignorePatterns: ['**/*.stories.tsx'],
  plugins: ['polar-rules'],
  rules: {
    '@next/next/no-html-link-for-pages': 'off',
    'react/jsx-key': 'error',
    'no-restricted-imports': [
      'warn',
      {
        patterns: [
          {
            group: [
              'polarkit/components/ui/*',
              '!polarkit/components/ui/atoms',
              '!polarkit/components/ui/molecules',
              '!polarkit/components/ui/Cards',
            ],
            message:
              'Direct usages of shadcn components are not allowed. Please use the proxied components in the atoms & molecules directories instead.',
          },
        ],
      },
    ],
    'polar-rules/enforce-github-capitalization': 'warn',
  },
}
