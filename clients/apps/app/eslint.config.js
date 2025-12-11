// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')
const noViewRule = require('./eslint-rules/no-view')
const noTextRule = require('./eslint-rules/no-text')
const noStyleSheetCreateRule = require('./eslint-rules/no-stylesheet-create')
const noImageRule = require('./eslint-rules/no-image')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    plugins: {
      '@polar': {
        rules: {
          'no-view': noViewRule,
          'no-text': noTextRule,
          'no-stylesheet-create': noStyleSheetCreateRule,
          'no-image': noImageRule,
        },
      },
    },
    rules: {
      '@polar/no-view': 'error',
      '@polar/no-text': 'error',
      '@polar/no-stylesheet-create': 'error',
      '@polar/no-image': 'error',
    },
  },
])
