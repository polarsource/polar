// Generated from customers:update (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag, nullableStringFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['customers']['update']>[1]>

export const command = Command.make(
  'update',
  {
    path: {
      id: Argument.String('id'),
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
      external_id: nullableStringFlag('external-id').pipe(
        Flag.optional,
        Flag.withDescription(
          "The ID of the customer in your system. This must be unique within the organization. Once set, it can't be updated.",
        ),
      ),
      type: Flag.Literals('type', ['individual', 'team']).pipe(
        Flag.optional,
        Flag.withDescription(
          "The customer type. Can only be upgraded from 'individual' to 'team', never downgraded.",
        ),
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
        external_id: config.input.external_id,
        type: config.input.type,
      })
      yield* api.execute({
        operationId: 'customers:update',
        method: 'PATCH',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) => client.customers.update(config.path.id, body),
      })
    }),
).pipe(Command.withDescription('Update a customer.'))
