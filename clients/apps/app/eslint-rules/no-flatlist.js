/**
 * ESLint rule to prevent usage of <FlatList /> from react-native.
 * Use <FlashList /> from @shopify/flash-list instead.
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Discourage usage of FlatList from react-native. Use FlashList from @shopify/flash-list instead.',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noFlatList:
        "You probably shouldn't use <FlatList />, prefer using <FlashList /> instead.",
    },
  },

  create(context) {
    let flatListImportedFromReactNative = false

    return {
      ImportDeclaration(node) {
        if (node.source.value === 'react-native') {
          const flatListSpecifier = node.specifiers.find(
            (specifier) =>
              specifier.type === 'ImportSpecifier' &&
              specifier.imported.name === 'FlatList',
          )
          if (flatListSpecifier) {
            flatListImportedFromReactNative = true
          }
        }
      },

      JSXIdentifier(node) {
        if (
          flatListImportedFromReactNative &&
          node.name === 'FlatList' &&
          node.parent.type === 'JSXOpeningElement'
        ) {
          context.report({
            node,
            messageId: 'noFlatList',
          })
        }
      },

      'Program:exit'() {
        flatListImportedFromReactNative = false
      },
    }
  },
}
