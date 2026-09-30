// Generated from customers:update_external (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag, nullableStringFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['customers']['updateExternal']>[1]>

export const command = Command.make(
  'update_external',
  {
    path: {
      external_id: Argument.String('external_id'),
    },
    data,
    input: {
      metadata: jsonFlag('metadata').pipe(
        Flag.optional,
        Flag.withDescription(
          'Key-value object allowing you to store additional information. JSON: {"<key>": string | integer | number | boolean}',
        ),
      ),
      email: nullableStringFlag('email').pipe(
        Flag.optional,
        Flag.withDescription(
          'The email address of the customer. This must be unique within the organization.',
        ),
      ),
      name: nullableStringFlag('name').pipe(
        Flag.optional,
        Flag.withDescription('name'),
      ),
      billing_address: jsonFlag('billing-address').pipe(
        Flag.optional,
        Flag.withDescription(
          'billing_address JSON: {"country": "AD" | "AE" | "AF" | "AG" | "AI" | ..., ...}',
        ),
      ),
      tax_id: nullableStringFlag('tax-id').pipe(
        Flag.optional,
        Flag.withDescription('tax_id'),
      ),
      locale: nullableStringFlag('locale').pipe(
        Flag.optional,
        Flag.withDescription('locale'),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        metadata: config.input.metadata,
        email: config.input.email,
        name: config.input.name,
        billing_address: config.input.billing_address,
        tax_id: config.input.tax_id,
        locale: config.input.locale,
      })
      yield* api.execute({
        operationId: 'customers:update_external',
        method: 'PATCH',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) =>
          client.customers.updateExternal(config.path.external_id, body),
      })
    }),
).pipe(Command.withDescription('Update a customer by external ID.'))
