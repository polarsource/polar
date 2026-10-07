import { inDirectory, onModuleReference, typeOnly } from '../ast.js'

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A util in src/utils renders or transforms data. It may use the types a service exposes, but it never calls a service or a command.',
    },
    messages: {
      command: 'Utils must not depend on commands.',
      service:
        'Utils must not call services. Import only types from "{{source}}", or move this code into the service or the command.',
    },
  },
  create(context) {
    if (!inDirectory(context, 'utils')) return {}
    return onModuleReference((node, source) => {
      if (source.startsWith('@/commands/')) {
        context.report({ node, messageId: 'command' })
      } else if (source.startsWith('@/services/') && !typeOnly(node)) {
        context.report({ node, messageId: 'service', data: { source } })
      }
    })
  },
}
