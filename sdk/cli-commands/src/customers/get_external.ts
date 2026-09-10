// Generated from customers:get_external (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { production } from '../inputs'

export const command = Command.make(
  'get_external',
  {
    production,
    external_id: Argument.string('external_id'),
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'customers:get_external',
        method: 'GET',
        environment: config.production ? 'production' : 'sandbox',
        confirm: false,
        invoke: (client) => client.customers.getExternal(config.external_id),
      })
    }),
).pipe(Command.withDescription('Get a customer by external ID.'))
