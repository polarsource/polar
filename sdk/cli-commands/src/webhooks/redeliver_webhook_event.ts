// Generated from webhooks:redeliver_webhook_event (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'

export const command = Command.make(
  'redeliver_webhook_event',
  {
    path: {
      id: Argument.string('id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'webhooks:redeliver_webhook_event',
        method: 'POST',
        confirm: false,
        invoke: (client) =>
          client.webhooks.redeliverWebhookEvent(config.path.id),
      })
    }),
).pipe(Command.withDescription('Schedule the re-delivery of a webhook event.'))
