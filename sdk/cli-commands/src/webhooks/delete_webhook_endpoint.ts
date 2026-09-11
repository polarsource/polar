// Generated from webhooks:delete_webhook_endpoint (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { confirm } from '../inputs'

export const command = Command.make(
  'delete_webhook_endpoint',
  {
    confirm,
    path: {
      id: Argument.string('id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'webhooks:delete_webhook_endpoint',
        method: 'DELETE',
        requiresConfirmation: true,
        confirm: config.confirm,
        preview: {
          fields: [
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'url', label: 'URL' },
            { key: 'enabled', label: 'Enabled' },
          ],
          invoke: (client) =>
            client.webhooks.getWebhookEndpoint(config.path.id),
        },
        invoke: (client) =>
          client.webhooks.deleteWebhookEndpoint(config.path.id),
      })
    }),
).pipe(Command.withDescription('Delete a webhook endpoint.'))
