import { isFile, isMember } from '../ast.js'

const runners = new Set([
  'runPromise',
  'runPromiseExit',
  'runSync',
  'runSyncExit',
  'runFork',
  'runCallback',
])

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Effects are run once, in the entrypoint, so every failure reaches the shared error handler and telemetry.',
    },
    messages: {
      run: 'Do not run Effects here. Return the Effect and let cli.ts run it, or fork it inside Effect with Effect.forkDaemon.',
      main: 'BunRuntime.runMain belongs in cli.ts only.',
    },
  },
  create(context) {
    if (isFile(context, 'cli.ts')) return {}
    const filename = context.filename ?? context.getFilename()
    if (filename.endsWith('.test.ts') || filename.includes('/test-utils/')) {
      return {}
    }
    return {
      MemberExpression(node) {
        if (isMember(node, 'Effect') && runners.has(node.property.name)) {
          context.report({ node, messageId: 'run' })
        } else if (isMember(node, 'BunRuntime', 'runMain')) {
          context.report({ node, messageId: 'main' })
        }
      },
    }
  },
}
