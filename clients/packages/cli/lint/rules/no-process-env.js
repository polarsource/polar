import { isMember } from '../ast.js'

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Environment variables are read once, in an injectable default, so tests stay hermetic.',
    },
    messages: {
      env: 'Read environment variables through an injectable service (see the Environment reference in services/api.ts), not process.env.',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (isMember(node, 'process', 'env')) {
          context.report({ node, messageId: 'env' })
        }
      },
    }
  },
}
