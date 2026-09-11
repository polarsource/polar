// Generated from orders:invoice (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'

export const command = Command.make(
  'invoice',
  {
    path: {
      id: Argument.string('id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'orders:invoice',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) => client.orders.invoice(config.path.id),
      })
    }),
).pipe(Command.withDescription("Get an order's invoice data."))
