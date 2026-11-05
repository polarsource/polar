// Generated from orders:get (2026-10). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import { fields, org } from '../inputs'

export const command = Command.make(
  'get',
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
        operationId: 'orders:get',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        organizationId: config.org,
        fields: config.fields,
        invoke: (client) => client.orders.get(config.path.id),
      })
    }),
).pipe(Command.withDescription('Get an order by ID.'))
