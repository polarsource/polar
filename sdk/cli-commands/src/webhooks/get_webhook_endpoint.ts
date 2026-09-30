// Generated from webhooks:get_webhook_endpoint (2026-10). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { fields } from '../inputs'

export const command = Command.make(
  'get_webhook_endpoint',
  {
    fields,
    path: {
      id: Argument.String('id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'webhooks:get_webhook_endpoint',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        fields: config.fields,
        invoke: (client) => client.webhooks.getWebhookEndpoint(config.path.id),
      })
    }),
).pipe(Command.withDescription('Get a webhook endpoint by ID.'))
