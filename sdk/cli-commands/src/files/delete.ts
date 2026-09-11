// Generated from files:delete (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { confirm } from '../inputs'

export const command = Command.make(
  'delete',
  {
    confirm,
    path: {
      id: Argument.string('id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'files:delete',
        method: 'DELETE',
        confirm: config.confirm,
        invoke: (client) => client.files.delete(config.path.id),
      })
    }),
).pipe(Command.withDescription('Delete a file.'))
