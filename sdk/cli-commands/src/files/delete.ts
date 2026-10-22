// Generated from files:delete (2026-10). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import { confirm, org } from '../inputs'

export const command = Command.make(
  'delete',
  {
    confirm,
    org,
    path: {
      id: Argument.String('id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'files:delete',
        method: 'DELETE',
        requiresConfirmation: true,
        confirm: config.confirm,
        organizationId: config.org,
        invoke: (client) => client.files.delete(config.path.id),
      })
    }),
).pipe(Command.withDescription('Delete a file.'))
