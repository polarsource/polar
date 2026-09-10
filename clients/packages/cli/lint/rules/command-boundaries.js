import { inDirectory } from '../ast.js'

const forbiddenImports = [
  {
    matches: (source) => source.startsWith('effect/unstable/http'),
    messageId: 'http',
  },
  {
    matches: (source) => source.startsWith('@polar-sh/sdk'),
    messageId: 'sdk',
  },
  {
    matches: (source) =>
      [
        '@/services/api',
        '@/services/client',
        '@/services/config',
        '@/services/credentials',
        '@/services/oauth',
      ].includes(source),
    messageId: 'lowLevel',
  },
]

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A command in src/commands must not talk to the API directly. It parses input, calls a service, and prints the result.',
    },
    messages: {
      http: 'Commands must not call the API directly. Add or use a method on a service in src/services.',
      sdk: 'Commands must not use the SDK directly. Go through the Polar service.',
      lowLevel:
        'Commands use the high-level services (Auth, Organizations, Polar, Trigger), not the ones underneath them.',
      fetch:
        'Commands must not make HTTP requests. Add or use a method on a service in src/services.',
    },
  },
  create(context) {
    if (!inDirectory(context, 'commands')) return {}
    return {
      ImportDeclaration(node) {
        const source = node.source.value
        const rule = forbiddenImports.find(({ matches }) => matches(source))
        if (rule) context.report({ node, messageId: rule.messageId })
      },
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'fetch') {
          context.report({ node, messageId: 'fetch' })
        }
      },
    }
  },
}
