// Generated from custom-fields:delete (2026-04). Do not edit.
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
        operationId: 'custom-fields:delete',
        method: 'DELETE',
        requiresConfirmation: true,
        confirm: config.confirm,
        preview: {
          fields: [
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'slug', label: 'Slug' },
            { key: 'type', label: 'Type' },
          ],
          invoke: (client) => client.customFields.get(config.path.id),
        },
        invoke: (client) => client.customFields.delete(config.path.id),
      })
    }),
).pipe(Command.withDescription('Delete a custom field.'))
