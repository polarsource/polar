// Generated from customers:get_external (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'

export const command = Command.make(
  'get_external',
  {
    path: {
      external_id: Argument.string('external_id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'customers:get_external',
        method: 'GET',
        confirm: false,
        invoke: (client) =>
          client.customers.getExternal(config.path.external_id),
      })
    }),
).pipe(Command.withDescription('Get a customer by external ID.'))
