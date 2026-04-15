/** @type {import('eslint').Rule.RuleModule} */
const noStyleBox = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow the `style` prop on <Box />',
    },
    schema: [],
    messages: {
      noStyle: 'Do not use style on <Box />. Use design system props instead.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'Box') {
          return
        }
        for (const attr of node.attributes) {
          if (
            attr.type === 'JSXAttribute' &&
            attr.name.type === 'JSXIdentifier' &&
            attr.name.name === 'style'
          ) {
            context.report({ node: attr, messageId: 'noStyle' })
          }
        }
      },
    }
  },
}

export default noStyleBox
