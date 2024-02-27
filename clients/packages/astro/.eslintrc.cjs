module.exports = {
  env: {
    node: true,
  },
  extends: ['plugin:astro/recommended'],
  overrides: [
    {
      files: ['*.astro'],
      parser: 'astro-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
        extraFileExtensions: ['.astro'],
      },
    },
    {
      files: ['*.ts'],
      parser: '@typescript-eslint/parser',
    },
  ],
  rules: {
    // We don't want to leak logging into our user's console unless it's an error
    'no-console': ['error', { allow: ['warn', 'error'] }],
  },
};
