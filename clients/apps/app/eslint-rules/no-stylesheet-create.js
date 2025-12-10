/**
 * ESLint rule to prevent usage of StyleSheet.create().
 * Use inline styles or Restyle Box/Text components instead.
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow usage of StyleSheet.create(). Use inline styles or Restyle components instead.',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noStyleSheetCreate:
        'Do not use StyleSheet.create(). Use <Box /> or <Text /> with theme tokens instead.',
    },
  },

  create(context) {
    let styleSheetImported = false

    return {
      ImportDeclaration(node) {
        if (node.source.value === 'react-native') {
          const styleSheetSpecifier = node.specifiers.find(
            (specifier) =>
              specifier.type === 'ImportSpecifier' &&
              specifier.imported.name === 'StyleSheet',
          )
          if (styleSheetSpecifier) {
            styleSheetImported = true
          }
        }
      },

      CallExpression(node) {
        if (
          styleSheetImported &&
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'StyleSheet' &&
          node.callee.property.name === 'create'
        ) {
          context.report({
            node,
            messageId: 'noStyleSheetCreate',
          })
        }
      },

      'Program:exit'() {
        styleSheetImported = false
      },
    }
  },
}
