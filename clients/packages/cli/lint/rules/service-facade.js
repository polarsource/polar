import { inDirectory, isTest, onModuleReference } from '../ast.js'

const internal = /^@\/services\/[^/]+\/(?!service$).+$/

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A service split into a directory exposes one entry point, service.ts. Nothing outside the service imports its internal modules.',
    },
    messages: {
      internal:
        'Import the service from "{{facade}}" instead of reaching into its internals.',
    },
  },
  create(context) {
    if (inDirectory(context, 'services') || isTest(context)) return {}
    return onModuleReference((node, source) => {
      if (internal.test(source)) {
        const facade = `${source.split('/').slice(0, 3).join('/')}/service`
        context.report({ node, messageId: 'internal', data: { facade } })
      }
    })
  },
}
