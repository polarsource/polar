// Generated from customers:delete (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { production, confirm, data, mergeInput } from '../inputs'

type Query = NonNullable<Parameters<Polar['customers']['delete']>[1]>

export const command = Command.make(
  'delete',
  {
    production,
    confirm,
    id: Argument.string('id'),
    data,
    anonymize: Flag.boolean('anonymize').pipe(
      Flag.optional,
      Flag.withDescription(
        "If true, also anonymize the customer's personal data for GDPR compliance. This replaces email with a hashed version, hashes name and billing name (name preserved for businesses with tax_id), clears billing address, and removes OAuth account data.",
      ),
    ),
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const query = mergeInput<Query>(config.data, {
        anonymize: config.anonymize,
      })
      yield* api.execute({
        operationId: 'customers:delete',
        method: 'DELETE',
        environment: config.production ? 'production' : 'sandbox',
        confirm: config.confirm,
        invoke: (client) => client.customers.delete(config.id, query),
      })
    }),
).pipe(Command.withDescription('Delete a customer.'))
