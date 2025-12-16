/**
 * ESLint rule to prevent usage of useTheme from @shopify/restyle.
 * Use useTheme from @/design-system/useTheme instead.
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow usage of useTheme from @shopify/restyle. Use useTheme from @/design-system/useTheme instead.',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noRestyleUseTheme:
        'Do not import useTheme from @shopify/restyle, it is not typed to our design system. Use useTheme from @/design-system/useTheme instead.',
    },
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value === '@shopify/restyle') {
          const useThemeSpecifier = node.specifiers.find(
            (specifier) =>
              specifier.type === 'ImportSpecifier' &&
              specifier.imported.name === 'useTheme',
          )
          if (useThemeSpecifier) {
            context.report({
              node: useThemeSpecifier,
              messageId: 'noRestyleUseTheme',
            })
          }
        }
      },
    }
  },
}
