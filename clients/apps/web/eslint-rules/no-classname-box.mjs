/** @type {import('eslint').Rule.RuleModule} */
const noClassnameBox = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow the `className` prop on <Box />',
    },
    schema: [],
    messages: {
      noClassName:
        'Do not use className on <Box />. Use design system props instead.',
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
            attr.name.name === 'className'
          ) {
            context.report({ node: attr, messageId: 'noClassName' })
          }
        }
      },
    }
  },
}

export default noClassnameBox
