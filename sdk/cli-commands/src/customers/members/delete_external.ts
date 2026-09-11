// Generated from customers:members:delete_external (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../../runtime'
import { confirm } from '../../inputs'

export const command = Command.make(
  'delete_external',
  {
    confirm,
    path: {
      external_id: Argument.string('external_id'),
      member_external_id: Argument.string('member_external_id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'customers:members:delete_external',
        method: 'DELETE',
        confirm: config.confirm,
        preview: {
          fields: [
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'external_id', label: 'External ID' },
            { key: 'role', label: 'Role' },
          ],
          invoke: (client) =>
            client.customers.members.getExternal(
              config.path.external_id,
              config.path.member_external_id,
            ),
        },
        invoke: (client) =>
          client.customers.members.deleteExternal(
            config.path.external_id,
            config.path.member_external_id,
          ),
      })
    }),
).pipe(
  Command.withDescription(
    'Delete a member by external ID for a customer identified by its external ID.',
  ),
)
