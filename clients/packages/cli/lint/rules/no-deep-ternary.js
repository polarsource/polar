const FUNCTIONS = [
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'A conditional expression never sits inside another one in the same function; name the inner choice or use if statements.',
    },
    messages: {
      nested:
        'Do not nest a conditional expression inside another one. Move the inner choice into a named const or helper, or use if statements with early returns.',
    },
  },
  create(context) {
    const open = [0]
    const visitors = {
      ConditionalExpression(node) {
        if (open.at(-1) > 0) context.report({ node, messageId: 'nested' })
        open[open.length - 1] += 1
      },
      'ConditionalExpression:exit'() {
        open[open.length - 1] -= 1
      },
    }
    for (const type of FUNCTIONS) {
      visitors[type] = () => open.push(0)
      visitors[`${type}:exit`] = () => open.pop()
    }
    return visitors
  },
}
