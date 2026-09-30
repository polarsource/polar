// Generated from webhooks:redeliver_webhook_event (2026-10). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { fields } from '../inputs'

export const command = Command.make(
  'redeliver_webhook_event',
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
        operationId: 'webhooks:redeliver_webhook_event',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        fields: config.fields,
        invoke: (client) =>
          client.webhooks.redeliverWebhookEvent(config.path.id),
      })
    }),
).pipe(Command.withDescription('Schedule the re-delivery of a webhook event.'))
