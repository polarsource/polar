// Generated from orders:invoice (2026-10). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { fields } from '../inputs'

export const command = Command.make(
  'invoice',
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
        operationId: 'orders:invoice',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        fields: config.fields,
        invoke: (client) => client.orders.invoice(config.path.id),
      })
    }),
).pipe(Command.withDescription("Get an order's invoice data."))
