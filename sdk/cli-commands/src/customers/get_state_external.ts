// Generated from customers:get_state_external (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { production } from '../inputs'

export const command = Command.make(
  'get_state_external',
  {
    production,
    external_id: Argument.string('external_id'),
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'customers:get_state_external',
        method: 'GET',
        environment: config.production ? 'production' : 'sandbox',
        confirm: false,
        invoke: (client) =>
          client.customers.getStateExternal(config.external_id),
      })
    }),
).pipe(Command.withDescription('Get a customer state by external ID.'))
