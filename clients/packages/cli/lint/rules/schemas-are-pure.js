import { inDirectory, onModuleReference } from '../ast.js'

const allowed = (source) =>
  source === 'effect' ||
  source.startsWith('effect/') ||
  (source.startsWith('@/schemas/') && !source.split('/').includes('..'))

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A schema in src/schemas describes data and errors shared by every layer. It imports only effect and other schemas.',
    },
    messages: {
      impure:
        'Schemas must not import "{{source}}". Keep src/schemas free of services, utils and commands so every layer can depend on it.',
    },
  },
  create(context) {
    if (!inDirectory(context, 'schemas')) return {}
    return onModuleReference((node, source) => {
      if (!allowed(source)) {
        context.report({ node, messageId: 'impure', data: { source } })
      }
    })
  },
}
