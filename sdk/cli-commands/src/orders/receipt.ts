// Generated from orders:receipt (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'

export const command = Command.make(
  'receipt',
  {
    path: {
      id: Argument.string('id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'orders:receipt',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) => client.orders.receipt(config.path.id),
      })
    }),
).pipe(
  Command.withDescription(
    "Get a presigned URL to download an order's receipt PDF.",
  ),
)
