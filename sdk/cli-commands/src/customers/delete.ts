// Generated from customers:delete (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { confirm, data, mergeInput } from '../inputs'

type Query = NonNullable<Parameters<Polar['customers']['delete']>[1]>

export const command = Command.make(
  'delete',
  {
    confirm,
    path: {
      id: Argument.string('id'),
    },
    data,
    input: {
      anonymize: Flag.boolean('anonymize').pipe(
        Flag.optional,
        Flag.withDescription(
          "If true, also anonymize the customer's personal data for GDPR compliance. This replaces email with a hashed version, hashes name and billing name (name preserved for businesses with tax_id), clears billing address, and removes OAuth account data.",
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
        operationId: 'customers:delete',
        method: 'DELETE',
        confirm: config.confirm,
        preview: {
          fields: [
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'external_id', label: 'External ID' },
          ],
          invoke: (client) => client.customers.get(config.path.id),
        },
        invoke: (client) => client.customers.delete(config.path.id, query),
      })
    }),
).pipe(Command.withDescription('Delete a customer.'))
