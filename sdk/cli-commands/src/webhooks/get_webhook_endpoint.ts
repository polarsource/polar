// Generated from webhooks:get_webhook_endpoint (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'

export const command = Command.make(
  'get_webhook_endpoint',
  {
    path: {
      id: Argument.string('id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'webhooks:get_webhook_endpoint',
        method: 'GET',
        confirm: false,
        invoke: (client) => client.webhooks.getWebhookEndpoint(config.path.id),
      })
    }),
).pipe(Command.withDescription('Get a webhook endpoint by ID.'))
