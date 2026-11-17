// Generated from webhooks:get_external_webhook_endpoint (2027-01). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import { fields } from '../inputs'

export const command = Command.make(
  'get_external_webhook_endpoint',
  {
    fields,
    path: {
      external_id: Argument.String('external_id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'webhooks:get_external_webhook_endpoint',
        apiVersion: '2027-01',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        fields: config.fields,
        invoke: (client) =>
          client.webhooks.getExternalWebhookEndpoint(config.path.external_id),
      })
    }),
).pipe(
  Command.withDescription(
    'Get a webhook endpoint by external ID. (preview, API 2027-01)',
  ),
)
