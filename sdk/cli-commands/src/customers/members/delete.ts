// Generated from customers:members:delete (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../../runtime'
import { confirm } from '../../inputs'

export const command = Command.make(
  'delete',
  {
    confirm,
    path: {
      id: Argument.string('id'),
      member_id: Argument.string('member_id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'customers:members:delete',
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
            client.customers.members.get(config.path.id, config.path.member_id),
        },
        invoke: (client) =>
          client.customers.members.delete(
            config.path.id,
            config.path.member_id,
          ),
      })
    }),
).pipe(Command.withDescription('Delete a member of a customer.'))
