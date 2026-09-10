import { isMember } from '../ast.js'

const outputCalls = new Set(['log', 'error', 'warn', 'info', 'debug'])

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
        'Services return data and typed errors; printing belongs to commands.',
    },
    messages: {
      output:
        'Do not print from a service. Return data or a typed error and let the command render it.',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (
          (isMember(node, 'Console') || isMember(node, 'console')) &&
          outputCalls.has(node.property.name)
        ) {
          context.report({ node, messageId: 'output' })
        }
        if (isProcessStream(node)) {
          context.report({ node, messageId: 'output' })
        }
      },
    }
  },
}
