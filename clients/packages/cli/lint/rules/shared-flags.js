import { inSource, isFile, isMember, isTest, propertyName } from '../ast.js'

const shared = new Set(['confirm', 'org', 'sandbox', 'production', 'local'])

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Flags that several commands take are defined once in src/utils/flags.ts, so they read and behave the same in every command.',
    },
    messages: {
      shared:
        'Flag "{{name}}" is shared between commands. Import it from @/utils/flags instead of defining it here, so it has one description and one set of aliases.',
    },
  },
  create(context) {
    if (!inSource(context) || isTest(context)) return {}
    if (isFile(context, 'utils/flags.ts')) return {}
    return {
      CallExpression(node) {
        if (!isMember(node.callee, 'Flag')) return
        if (propertyName(node.callee).startsWith('with')) return
        const [name] = node.arguments
        if (name?.type !== 'Literal' || !shared.has(name.value)) return
        context.report({
          node,
          messageId: 'shared',
          data: { name: name.value },
        })
      },
    }
  },
}
