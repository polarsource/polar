/**
 * ESLint rule to prevent usage of <View /> from react-native.
 * Use <Box /> from @/components/Shared/Box instead.
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow usage of View from react-native. Use Box from @/components/Shared/Box instead.',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noView:
        'Do not use <View /> from react-native. Use <Box /> from @/components/Shared/Box instead.',
    },
  },

  create(context) {
    let viewImportedFromReactNative = false

    return {
      ImportDeclaration(node) {
        if (node.source.value === 'react-native') {
          const viewSpecifier = node.specifiers.find(
            (specifier) =>
              specifier.type === 'ImportSpecifier' &&
              specifier.imported.name === 'View',
          )
          if (viewSpecifier) {
            viewImportedFromReactNative = true
          }
        }
      },

      JSXIdentifier(node) {
        if (
          viewImportedFromReactNative &&
          node.name === 'View' &&
          node.parent.type === 'JSXOpeningElement'
        ) {
          context.report({
            node,
            messageId: 'noView',
          })
        }
      },

      'Program:exit'() {
        viewImportedFromReactNative = false
      },
    }
  },
}
