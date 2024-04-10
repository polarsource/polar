module.exports = {
  extends: ['next', 'turbo', 'prettier', 'next/core-web-vitals'],
  ignorePatterns: ['**/*.stories.tsx'],
  plugins: ['polar-rules'],
  rules: {
    '@next/next/no-html-link-for-pages': 'off',
    'react/jsx-key': 'error',
    'polar-rules/enforce-github-capitalization': 'warn',
  },
}
