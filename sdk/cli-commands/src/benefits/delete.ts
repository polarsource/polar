// Generated from benefits:delete (2026-04). Do not edit.
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
        operationId: 'benefits:delete',
        method: 'DELETE',
        requiresConfirmation: true,
        confirm: config.confirm,
        preview: {
          fields: [
            { key: 'id', label: 'ID' },
            { key: 'type', label: 'Type' },
            { key: 'description', label: 'Description' },
          ],
          invoke: (client) => client.benefits.get(config.path.id),
        },
        invoke: (client) => client.benefits.delete(config.path.id),
      })
    }),
).pipe(Command.withDescription('Delete a benefit.'))
