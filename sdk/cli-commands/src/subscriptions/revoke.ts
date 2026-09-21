// Generated from subscriptions:revoke (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { confirm } from '../inputs'

export const command = Command.make(
  'revoke',
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
        operationId: 'subscriptions:revoke',
        method: 'DELETE',
        requiresConfirmation: true,
        confirm: config.confirm,
        preview: {
          fields: [
            { key: 'id', label: 'ID' },
            { key: 'status', label: 'Status' },
            { key: 'customer_id', label: 'Customer ID' },
            { key: 'product_id', label: 'Product ID' },
          ],
          invoke: (client) => client.subscriptions.get(config.path.id),
        },
        invoke: (client) => client.subscriptions.revoke(config.path.id),
      })
    }),
).pipe(
  Command.withDescription('Revoke a subscription, i.e cancel immediately.'),
)
