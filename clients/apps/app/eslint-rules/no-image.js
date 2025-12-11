/**
 * ESLint rule to prevent usage of <Image /> from react-native or expo-image.
 * Use <Image /> from @/components/Shared/Image instead.
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow usage of Image from react-native or expo-image. Use Image from @/components/Shared/Image instead.',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noImage:
        'Do not use <Image /> from react-native or expo-image. Use <Image /> from @/components/Shared/Image instead.',
    },
  },

  create(context) {
    let imageImportedFromDisallowed = false

    return {
      ImportDeclaration(node) {
        if (
          node.source.value === 'react-native' ||
          node.source.value === 'expo-image'
        ) {
          const imageSpecifier = node.specifiers.find(
            (specifier) =>
              specifier.type === 'ImportSpecifier' &&
              specifier.imported.name === 'Image',
          )
          if (imageSpecifier) {
            imageImportedFromDisallowed = true
          }
        }
      },

      JSXIdentifier(node) {
        if (
          imageImportedFromDisallowed &&
          node.name === 'Image' &&
          node.parent.type === 'JSXOpeningElement'
        ) {
          context.report({
            node,
            messageId: 'noImage',
          })
        }
      },

      'Program:exit'() {
        imageImportedFromDisallowed = false
      },
    }
  },
}
