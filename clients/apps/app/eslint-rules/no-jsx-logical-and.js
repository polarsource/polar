/**
 * ESLint rule to prevent usage of && operator for conditional rendering in JSX.
 * Use ternary expressions instead: {condition ? <Component /> : null}
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow && operator for conditional rendering in JSX. Use ternary expressions instead.',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noLogicalAnd:
        'Do not use && for conditional rendering, this can crash the app. Use a ternary expression instead: {condition ? <Component /> : null}',
    },
  },

  create(context) {
    return {
      LogicalExpression(node) {
        if (node.operator !== '&&') {
          return
        }

        const isInJSXExpression = node.parent.type === 'JSXExpressionContainer'

        const rightIsJSX =
          node.right.type === 'JSXElement' || node.right.type === 'JSXFragment'

        if (isInJSXExpression && rightIsJSX) {
          context.report({
            node,
            messageId: 'noLogicalAnd',
          })
        }
      },
    }
  },
}
