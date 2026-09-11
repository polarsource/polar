// Generated from checkouts:get (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'

export const command = Command.make(
  'get',
  {
    path: {
      id: Argument.string('id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'checkouts:get',
        method: 'GET',
        confirm: false,
        invoke: (client) => client.checkouts.get(config.path.id),
      })
    }),
).pipe(Command.withDescription('Get a checkout session by ID.'))
