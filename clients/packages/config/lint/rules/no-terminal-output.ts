import { isMember } from '../ast.ts'
import { isTestFile, locate, sourceOf } from '../paths.ts'
import type { Node, Rule } from '../types.ts'

const promptModules = new Set([
  'effect/cli',
  'node:readline',
  'node:readline/promises',
])

const isPromptModule = (
  node: Node<'ImportDeclaration'> | Node<'ImportExpression'>,
) => {
  const source = sourceOf(node)
  return source !== undefined && promptModules.has(source)
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'The SDK runs inside the customer’s application, so it never prints or prompts. Commands that talk to a terminal live in packages/cli.',
    },
    messages: {
      print:
        'The SDK must not print. Return data or throw a typed error and let the caller decide what to show.',
      prompt:
        'The SDK must not prompt or parse flags. That belongs in packages/cli.',
    },
  },
  create(context) {
    const file = locate(context)
    if (file === undefined || isTestFile(file)) return {}
    return {
      ImportDeclaration(node) {
        if (node.importKind !== 'type' && isPromptModule(node)) {
          context.report({ node, messageId: 'prompt' })
        }
      },
      ImportExpression(node) {
        if (isPromptModule(node)) context.report({ node, messageId: 'prompt' })
      },
      MemberExpression(node) {
        if (
          isMember(node, 'console') ||
          isMember(node, 'process', 'stdout') ||
          isMember(node, 'process', 'stderr')
        ) {
          context.report({ node, messageId: 'print' })
        }
      },
    }
  },
} satisfies Rule
