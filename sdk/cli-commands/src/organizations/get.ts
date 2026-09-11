// Generated from organizations:get (2026-04). Do not edit.
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
        operationId: 'organizations:get',
        method: 'GET',
        confirm: false,
        invoke: (client) => client.organizations.get(config.path.id),
      })
    }),
).pipe(Command.withDescription('Get an organization by ID.'))
