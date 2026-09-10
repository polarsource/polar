import { inDirectory, isFile, isMember } from '../ast.js'

const allowed = [
  'cli.ts',
  'services/api.ts',
  'services/auth.ts',
  'services/config.ts',
  'services/telemetry.ts',
]

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
    if (
      isFile(context, ...allowed) ||
      (!inDirectory(context, 'services') &&
        !inDirectory(context, 'commands') &&
        !inDirectory(context, 'utils'))
    ) {
      return {}
    }
    return {
      MemberExpression(node) {
        if (isMember(node, 'process', 'env')) {
          context.report({ node, messageId: 'env' })
        }
      },
    }
  },
}
