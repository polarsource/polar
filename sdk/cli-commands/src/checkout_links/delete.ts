// Generated from checkout-links:delete (2026-10). Do not edit.
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
        operationId: 'checkout-links:delete',
        method: 'DELETE',
        requiresConfirmation: true,
        confirm: config.confirm,
        organizationId: config.org,
        preview: {
          fields: [
            { key: 'id', label: 'ID' },
            { key: 'label', label: 'Label' },
            { key: 'url', label: 'URL' },
          ],
          invoke: (client) => client.checkoutLinks.get(config.path.id),
        },
        invoke: (client) => client.checkoutLinks.delete(config.path.id),
      })
    }),
).pipe(Command.withDescription('Delete a checkout link.'))
