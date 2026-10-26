import { inSource, isMember, isTest, propertyName } from '../ast.js'

const names = new Set(['yes', 'y'])

const namesFlag = (method) =>
  method === 'withAlias' || !method.startsWith('with')

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A flag that skips a confirmation prompt is named --confirm, never --yes, so every command takes the same flag.',
    },
    messages: {
      yes: 'Flag "{{name}}" looks like a confirmation flag. Name it "confirm" with alias "c", like every other command that skips a confirmation prompt.',
    },
  },
  create(context) {
    if (!inSource(context) || isTest(context)) return {}
    return {
      CallExpression(node) {
        if (!isMember(node.callee, 'Flag')) return
        if (!namesFlag(propertyName(node.callee))) return
        const [name] = node.arguments
        if (name?.type !== 'Literal' || !names.has(name.value)) return
        context.report({ node, messageId: 'yes', data: { name: name.value } })
      },
    }
  },
}
