/**
 * ESLint rule to prevent hardcoded color values in styles.
 * Use theme.colors tokens instead.
 */

const COLOR_PROPERTIES = [
  'color',
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderRightColor',
  'shadowColor',
  'textShadowColor',
  'textDecorationColor',
  'tintColor',
  'overlayColor',
]

const HEX_COLOR_REGEX =
  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const RGB_RGBA_REGEX = /^rgba?\s*\(/i
const HSL_HSLA_REGEX = /^hsla?\s*\(/i

function isHardcodedColor(value) {
  if (typeof value !== 'string') return false

  return (
    HEX_COLOR_REGEX.test(value) ||
    RGB_RGBA_REGEX.test(value) ||
    HSL_HSLA_REGEX.test(value)
  )
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hardcoded color values in styles. Use theme.colors tokens instead.',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noHardcodedColor:
        "Do not use hardcoded color '{{ value }}' for '{{ property }}'. Use theme.colors.X instead.",
    },
  },

  create(context) {
    function checkProperty(node) {
      if (
        node.key &&
        node.key.type === 'Identifier' &&
        COLOR_PROPERTIES.includes(node.key.name) &&
        node.value &&
        node.value.type === 'Literal' &&
        isHardcodedColor(node.value.value)
      ) {
        context.report({
          node: node.value,
          messageId: 'noHardcodedColor',
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
