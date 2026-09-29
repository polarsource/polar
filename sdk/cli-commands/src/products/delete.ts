// Generated from products:delete (2026-10). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { confirm } from '../inputs'

export const command = Command.make(
  'delete',
  {
    confirm,
    path: {
      id: Argument.String('id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'products:delete',
        method: 'DELETE',
        requiresConfirmation: true,
        confirm: config.confirm,
        preview: {
          fields: [
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'is_archived', label: 'Archived' },
          ],
          invoke: (client) => client.products.get(config.path.id),
        },
        invoke: (client) => client.products.delete(config.path.id),
      })
    }),
).pipe(Command.withDescription('Delete a product.'))
