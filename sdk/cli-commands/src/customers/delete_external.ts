// Generated from customers:delete_external (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { confirm, data, mergeInput } from '../inputs'

type Query = NonNullable<Parameters<Polar['customers']['deleteExternal']>[1]>

export const command = Command.make(
  'delete_external',
  {
    confirm,
    path: {
      external_id: Argument.string('external_id'),
    },
    data,
    input: {
      anonymize: Flag.boolean('anonymize').pipe(
        Flag.optional,
        Flag.withDescription(
          "If true, also anonymize the customer's personal data for GDPR compliance.",
        ),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const query = mergeInput<Query>(config.data, {
        anonymize: config.input.anonymize,
      })
      yield* api.execute({
        operationId: 'customers:delete_external',
        method: 'DELETE',
        confirm: config.confirm,
        preview: {
          fields: [
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'external_id', label: 'External ID' },
          ],
          invoke: (client) =>
            client.customers.getExternal(config.path.external_id),
        },
        invoke: (client) =>
          client.customers.deleteExternal(config.path.external_id, query),
      })
    }),
).pipe(Command.withDescription('Delete a customer by external ID.'))
