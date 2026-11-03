// Generated from customers:get_state_external (2026-10). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import { fields } from '../inputs'

export const command = Command.make(
  'get_state_external',
  {
    fields,
    path: {
      external_id: Argument.String('external_id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'customers:get_state_external',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        fields: config.fields,
        invoke: (client) =>
          client.customers.getStateExternal(config.path.external_id),
      })
    }),
).pipe(Command.withDescription('Get a customer state by external ID.'))
