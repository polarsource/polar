// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')
const noViewRule = require('./eslint-rules/no-view')
const noTextRule = require('./eslint-rules/no-text')
const noStyleSheetCreateRule = require('./eslint-rules/no-stylesheet-create')
const noImageRule = require('./eslint-rules/no-image')
const noFlatListRule = require('./eslint-rules/no-flatlist')
const noTouchableRule = require('./eslint-rules/no-touchable')
const noJsxLogicalAndRule = require('./eslint-rules/no-jsx-logical-and')
const noRestyleUseThemeRule = require('./eslint-rules/no-restyle-use-theme')

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
          'no-flatlist': noFlatListRule,
          'no-touchable': noTouchableRule,
          'no-jsx-logical-and': noJsxLogicalAndRule,
          'no-restyle-use-theme': noRestyleUseThemeRule,
        },
      },
    },
    rules: {
      '@polar/no-view': 'error',
      '@polar/no-text': 'error',
      '@polar/no-stylesheet-create': 'error',
      '@polar/no-image': 'error',
      '@polar/no-flatlist': 'error',
      '@polar/no-touchable': 'error',
      '@polar/no-jsx-logical-and': 'error',
      '@polar/no-restyle-use-theme': 'error',
    },
  },
])
