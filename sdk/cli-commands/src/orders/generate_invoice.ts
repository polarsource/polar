// Generated from orders:generate_invoice (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'

export const command = Command.make(
  'generate_invoice',
  {
    path: {
      id: Argument.string('id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'orders:generate_invoice',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) => client.orders.generateInvoice(config.path.id),
      })
    }),
).pipe(Command.withDescription("Trigger generation of an order's invoice."))
