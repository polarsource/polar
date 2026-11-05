// Generated from orders:generate_invoice (2026-10). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import { fields, org } from '../inputs'

export const command = Command.make(
  'generate_invoice',
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
        operationId: 'orders:generate_invoice',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        organizationId: config.org,
        fields: config.fields,
        invoke: (client) => client.orders.generateInvoice(config.path.id),
      })
    }),
).pipe(Command.withDescription("Trigger generation of an order's invoice."))
