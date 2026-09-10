// Generated from customers:update_external (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { production, data, mergeInput, jsonFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['customers']['updateExternal']>[1]>

export const command = Command.make(
  'update_external',
  {
    production,
    external_id: Argument.string('external_id'),
    data,
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
    name: Flag.string('name').pipe(Flag.optional, Flag.withDescription('name')),
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
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        metadata: config.metadata,
        email: config.email,
        name: config.name,
        billing_address: config.billing_address,
        tax_id: config.tax_id,
        locale: config.locale,
      })
      yield* api.execute({
        operationId: 'customers:update_external',
        method: 'PATCH',
        environment: config.production ? 'production' : 'sandbox',
        confirm: false,
        invoke: (client) =>
          client.customers.updateExternal(config.external_id, body),
      })
    }),
).pipe(Command.withDescription('Update a customer by external ID.'))
