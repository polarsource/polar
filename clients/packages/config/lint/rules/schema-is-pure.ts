import { isGlobal, isMember } from '../ast.ts'
import { areaOf, isTestFile, locate } from '../paths.ts'
import type { Rule } from '../types.ts'

const unstableMembers = [
  ['Date', 'now'],
  ['Math', 'random'],
  ['performance', 'now'],
  ['crypto', 'randomUUID'],
  ['crypto', 'getRandomValues'],
] as const

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Functions in src/schema only build plain objects, so the same billing file always compiles to the same config and can be loaded without a network or credentials.',
    },
    messages: {
      io: 'schema/ must not do I/O. It only builds the objects that describe the billing file.',
      unstable:
        'schema/ must be deterministic: the same billing file always produces the same config.',
    },
  },
  create(context) {
    const file = locate(context)
    if (file === undefined || isTestFile(file) || areaOf(file) !== 'schema') {
      return {}
    }
    return {
      CallExpression(node) {
        if (isGlobal(node.callee, 'fetch')) {
          context.report({ node, messageId: 'io' })
        } else if (isGlobal(node.callee, 'Date')) {
          context.report({ node, messageId: 'unstable' })
        }
      },
      NewExpression(node) {
        if (isGlobal(node.callee, 'Date') && node.arguments.length === 0) {
          context.report({ node, messageId: 'unstable' })
        }
      },
      MemberExpression(node) {
        if (isMember(node, 'process')) {
          context.report({ node, messageId: 'io' })
        } else if (
          unstableMembers.some(([object, name]) => isMember(node, object, name))
        ) {
          context.report({ node, messageId: 'unstable' })
        }
      },
    }
  },
} satisfies Rule
