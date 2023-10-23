module.exports = {
  extends: ['next', 'turbo', 'prettier', 'next/core-web-vitals'],
  ignorePatterns: ['**/*.stories.tsx'],
  rules: {
    '@next/next/no-html-link-for-pages': 'off',
    'react/jsx-key': 'warn',
  },
}
