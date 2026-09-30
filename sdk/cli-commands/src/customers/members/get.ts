// Generated from customers:members:get (2026-10). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../../runtime'

export const command = Command.make(
  'get',
  {
    path: {
      id: Argument.String('id'),
      member_id: Argument.String('member_id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'customers:members:get',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) =>
          client.customers.members.get(config.path.id, config.path.member_id),
      })
    }),
).pipe(Command.withDescription('Get a member of a customer by its ID.'))
