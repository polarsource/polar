/**
 * ESLint rule to prevent hardcoded dimension values in styles.
 * Use theme.dimension tokens instead.
 */

const DIMENSION_PROPERTIES = [
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
]

function isThemeSpacing(node) {
  // Matches: theme.spacing['spacing-X'] or theme.spacing.X
  if (node.type !== 'MemberExpression') return false

  const obj = node.object
  if (obj.type !== 'MemberExpression') return false

  return (
    obj.object.type === 'Identifier' &&
    obj.object.name === 'theme' &&
    obj.property.type === 'Identifier' &&
    obj.property.name === 'spacing'
  )
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hardcoded numeric values for dimension properties. Use theme.dimension tokens instead.',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noHardcodedDimension:
        "Do not use hardcoded value '{{ value }}' for '{{ property }}'. Use theme.dimension['dimension-X'] instead.",
      noSpacingForDimension:
        "Do not use theme.spacing for '{{ property }}'. Use theme.dimension['dimension-X'] instead.",
    },
  },

  create(context) {
    function checkProperty(node) {
      if (
        !node.key ||
        node.key.type !== 'Identifier' ||
        !DIMENSION_PROPERTIES.includes(node.key.name)
      ) {
        return
      }

      const propertyName = node.key.name

      // Check for hardcoded numeric values (but allow 0)
      if (
        node.value &&
        node.value.type === 'Literal' &&
        typeof node.value.value === 'number' &&
        node.value.value !== 0
      ) {
        context.report({
          node: node.value,
          messageId: 'noHardcodedDimension',
          data: {
            property: propertyName,
            value: node.value.value,
          },
        })
        return
      }

      if (node.value && isThemeSpacing(node.value)) {
        context.report({
          node: node.value,
          messageId: 'noSpacingForDimension',
          data: {
            property: propertyName,
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
