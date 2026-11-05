// Generated from webhooks:get_webhook_endpoint (2026-10). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import { fields, org } from '../inputs'

export const command = Command.make(
  'get_webhook_endpoint',
  {
    org,
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
        organizationId: config.org,
        fields: config.fields,
        invoke: (client) => client.webhooks.getWebhookEndpoint(config.path.id),
      })
    }),
).pipe(Command.withDescription('Get a webhook endpoint by ID.'))
