/**
 * ESLint rule to prevent usage of <Text /> from react-native.
 * Use <Text /> from @/components/Shared/Text instead.
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow usage of Text from react-native. Use Text from @/components/Shared/Text instead.',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noText:
        'Do not use <Text /> from react-native. Use <Text /> from @/components/Shared/Text instead.',
    },
  },

  create(context) {
    let textImportedFromReactNative = false

    return {
      ImportDeclaration(node) {
        if (node.source.value === 'react-native') {
          const textSpecifier = node.specifiers.find(
            (specifier) =>
              specifier.type === 'ImportSpecifier' &&
              specifier.imported.name === 'Text',
          )
          if (textSpecifier) {
            textImportedFromReactNative = true
          }
        }
      },

      JSXIdentifier(node) {
        if (
          textImportedFromReactNative &&
          node.name === 'Text' &&
          node.parent.type === 'JSXOpeningElement'
        ) {
          context.report({
            node,
            messageId: 'noText',
          })
        }
      },

      'Program:exit'() {
        textImportedFromReactNative = false
      },
    }
  },
}
