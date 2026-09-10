// Generated from customers:delete_external (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { production, confirm, data, mergeInput } from '../inputs'

type Query = NonNullable<Parameters<Polar['customers']['deleteExternal']>[1]>

export const command = Command.make(
  'delete_external',
  {
    production,
    confirm,
    external_id: Argument.string('external_id'),
    data,
    anonymize: Flag.boolean('anonymize').pipe(
      Flag.optional,
      Flag.withDescription(
        "If true, also anonymize the customer's personal data for GDPR compliance.",
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
        operationId: 'customers:delete_external',
        method: 'DELETE',
        environment: config.production ? 'production' : 'sandbox',
        confirm: config.confirm,
        invoke: (client) =>
          client.customers.deleteExternal(config.external_id, query),
      })
    }),
).pipe(Command.withDescription('Delete a customer by external ID.'))
