// Generated from webhooks:reset_webhook_endpoint_secret (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'

export const command = Command.make(
  'reset_webhook_endpoint_secret',
  {
    path: {
      id: Argument.string('id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'webhooks:reset_webhook_endpoint_secret',
        method: 'PATCH',
        confirm: false,
        invoke: (client) =>
          client.webhooks.resetWebhookEndpointSecret(config.path.id),
      })
    }),
).pipe(Command.withDescription('Regenerate a webhook endpoint secret.'))
