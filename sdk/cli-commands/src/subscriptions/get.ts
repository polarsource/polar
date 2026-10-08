// Generated from subscriptions:get (2026-10). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import { fields } from '../inputs'

export const command = Command.make(
  'get',
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
        operationId: 'subscriptions:get',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        fields: config.fields,
        invoke: (client) => client.subscriptions.get(config.path.id),
      })
    }),
).pipe(Command.withDescription('Get a subscription by ID.'))
