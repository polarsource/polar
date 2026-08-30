const emailDesignSystem = {
  rules: {
    'no-classname': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          noClassName:
            'To ensure we are consistent in our email designs, avoid className in email templates. Use a pre-existing component from src/components/foundation if possible.',
        },
      },
      create(context) {
        return {
          JSXAttribute(node) {
            if (node.name?.name === 'className') {
              context.report({ node, messageId: 'noClassName' })
            }
          },
        }
      },
    },
    'no-raw-text-elements': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          noRawText:
            'Use the design-system <Text> (or <Heading>/<Link>) instead of a raw <{{name}}> element.',
        },
      },
      create(context) {
        const banned = new Set([
          'p',
          'span',
          'a',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'strong',
          'em',
          'b',
          'i',
          'small',
        ])
        return {
          JSXOpeningElement(node) {
            const name = node.name
            if (name?.type === 'JSXIdentifier' && banned.has(name.name)) {
              context.report({
                node,
                messageId: 'noRawText',
                data: { name: name.name },
              })
            }
          },
        }
      },
    },
  },
}

export default emailDesignSystem
