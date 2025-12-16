/**
 * ESLint rule to prevent usage of Touchable components from react-native.
 * Use <Touchable /> from @/components/Shared/Touchable instead.
 */

const TOUCHABLE_COMPONENTS = [
  'TouchableHighlight',
  'TouchableOpacity',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
]

const ALLOWED_FILES = ['components/Shared/Touchable.tsx']

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow usage of Touchable components from react-native. Use Touchable from @/components/Shared/Touchable instead.',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noTouchable:
        'Do not use <{{ component }} /> from react-native. Use <Touchable /> from @/components/Shared/Touchable instead.',
    },
  },

  create(context) {
    const filename = context.filename || context.getFilename()
    const isAllowedFile = ALLOWED_FILES.some((allowed) =>
      filename.endsWith(allowed),
    )

    if (isAllowedFile) {
      return {}
    }

    const touchablesImportedFromReactNative = new Set()

    return {
      ImportDeclaration(node) {
        if (node.source.value === 'react-native') {
          node.specifiers.forEach((specifier) => {
            if (
              specifier.type === 'ImportSpecifier' &&
              TOUCHABLE_COMPONENTS.includes(specifier.imported.name)
            ) {
              touchablesImportedFromReactNative.add(specifier.imported.name)
            }
          })
        }
      },

      JSXIdentifier(node) {
        if (
          touchablesImportedFromReactNative.has(node.name) &&
          node.parent.type === 'JSXOpeningElement'
        ) {
          context.report({
            node,
            messageId: 'noTouchable',
            data: {
              component: node.name,
            },
          })
        }
      },

      'Program:exit'() {
        touchablesImportedFromReactNative.clear()
      },
    }
  },
}
