module.exports = {
  extends: ['next', 'turbo', 'prettier', 'next/core-web-vitals'],
  ignorePatterns: ['**/*.stories.tsx'],
  rules: {
    '@next/next/no-html-link-for-pages': 'off',
    'react/jsx-key': 'warn',
    "no-restricted-imports": ["warning", {
        patterns: [
          {
            "group": ["polarkit/components/ui/*", "!polarkit/components/ui/atoms", "!polarkit/components/ui/molecules", "!polarkit/components/ui/Cards", "!polarkit/components/ui/Form"], 
            "message": "Direct usages of shadcn components are not allowed. Please use the proxied components in the atoms & molecules directories instead."
          },
        ]
    }]
  },
}
