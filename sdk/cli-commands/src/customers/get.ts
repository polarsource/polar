// Generated from customers:get (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { production } from '../inputs'

export const command = Command.make(
  'get',
  {
    production,
    id: Argument.string('id'),
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'customers:get',
        method: 'GET',
        environment: config.production ? 'production' : 'sandbox',
        confirm: false,
        invoke: (client) => client.customers.get(config.id),
      })
    }),
).pipe(Command.withDescription('Get a customer by ID.'))
