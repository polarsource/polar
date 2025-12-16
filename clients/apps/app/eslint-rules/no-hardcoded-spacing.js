/**
 * ESLint rule to prevent hardcoded spacing values in styles.
 * Use theme.spacing tokens instead.
 */

const SPACING_PROPERTIES = [
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingHorizontal',
  'paddingVertical',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'gap',
  'rowGap',
  'columnGap',
]

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hardcoded numeric values for spacing properties. Use theme.spacing tokens instead.',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noHardcodedSpacing:
        "Do not use hardcoded value '{{ value }}' for '{{ property }}'. Use theme.spacing['spacing-X'] instead.",
    },
  },

  create(context) {
    function checkProperty(node) {
      if (
        node.key &&
        node.key.type === 'Identifier' &&
        SPACING_PROPERTIES.includes(node.key.name) &&
        node.value &&
        node.value.type === 'Literal' &&
        typeof node.value.value === 'number' &&
        node.value.value !== 0
      ) {
        context.report({
          node: node.value,
          messageId: 'noHardcodedSpacing',
          data: {
            property: node.key.name,
            value: node.value.value,
          },
        })
      }
    }

    return {
      Property(node) {
        checkProperty(node)
      },
    }
  },
}
