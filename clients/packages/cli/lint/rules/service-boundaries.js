import { inDirectory, isMember } from '../ast.js'

const forbiddenImports = [
  {
    matches: (source) => source.startsWith('@/commands/'),
    messageId: 'command',
  },
  {
    matches: (source) => source === '@/utils/ui',
    messageId: 'print',
  },
  {
    matches: (source) => source === 'effect/unstable/cli',
    messageId: 'prompt',
  },
]

const isProcessStream = (node) =>
  node.type === 'MemberExpression' &&
  node.property.type === 'Identifier' &&
  node.property.name === 'write' &&
  (isMember(node.object, 'process', 'stdout') ||
    isMember(node.object, 'process', 'stderr'))

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A service in src/services must not depend on a command, print, or prompt. It returns data and typed errors; the command renders them.',
    },
    messages: {
      command:
        'Services must not depend on commands. Move the shared code into a service or a schema.',
      print:
        'Services must not print. Return data or a typed error and let the command render it.',
      prompt:
        'Services must not prompt or parse flags. That belongs in a command.',
    },
  },
  create(context) {
    if (!inDirectory(context, 'services')) return {}
    return {
      ImportDeclaration(node) {
        const source = node.source.value
        const rule = forbiddenImports.find(({ matches }) => matches(source))
        if (rule) context.report({ node, messageId: rule.messageId })
      },
      MemberExpression(node) {
        if (isMember(node, 'Console') || isMember(node, 'console')) {
          context.report({ node, messageId: 'print' })
        } else if (isProcessStream(node)) {
          context.report({ node, messageId: 'print' })
        } else if (isMember(node, 'Prompt')) {
          context.report({ node, messageId: 'prompt' })
        }
      },
    }
  },
}
