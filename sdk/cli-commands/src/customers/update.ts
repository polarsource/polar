// Generated from customers:update (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['customers']['update']>[1]>

export const command = Command.make(
  'update',
  {
    path: {
      id: Argument.string('id'),
    },
    data,
    input: {
      metadata: jsonFlag('metadata').pipe(
        Flag.optional,
        Flag.withDescription(
          'Key-value object allowing you to store additional information.',
        ),
      ),
      email: Flag.string('email').pipe(
        Flag.optional,
        Flag.withDescription(
          'The email address of the customer. This must be unique within the organization.',
        ),
      ),
      name: Flag.string('name').pipe(
        Flag.optional,
        Flag.withDescription('name'),
      ),
      billing_address: jsonFlag('billing-address').pipe(
        Flag.optional,
        Flag.withDescription('billing_address'),
      ),
      tax_id: Flag.string('tax-id').pipe(
        Flag.optional,
        Flag.withDescription('tax_id'),
      ),
      locale: Flag.string('locale').pipe(
        Flag.optional,
        Flag.withDescription('locale'),
      ),
      external_id: Flag.string('external-id').pipe(
        Flag.optional,
        Flag.withDescription(
          "The ID of the customer in your system. This must be unique within the organization. Once set, it can't be updated.",
        ),
      ),
      type: Flag.choice('type', ['individual', 'team']).pipe(
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
        confirm: false,
        invoke: (client) => client.customers.update(config.path.id, body),
      })
    }),
).pipe(Command.withDescription('Update a customer.'))
