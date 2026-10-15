// Generated from subscriptions:create (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/cli'
import { ApiRuntime, ApiCommandError } from '../runtime'
import { fields, data, mergeInput, missingFlags, jsonFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['subscriptions']['create']>[0]>

export const command = Command.make(
  'create',
  {
    fields,
    data,
    input: {
      metadata: jsonFlag('metadata').pipe(
        Flag.optional,
        Flag.withDescription(
          'Key-value object allowing you to store additional information. JSON: {"<key>": string | integer | number | boolean}',
        ),
      ),
      product_id: Flag.String('product-id').pipe(
        Flag.optional,
        Flag.withDescription(
          'Required. The ID of the recurring product to subscribe to. Must be a free product, otherwise the customer should go through a checkout flow.',
        ),
      ),
      customer_id: Flag.String('customer-id').pipe(
        Flag.optional,
        Flag.withDescription(
          'The ID of the customer to create the subscription for.',
        ),
      ),
      external_customer_id: Flag.String('external-customer-id').pipe(
        Flag.optional,
        Flag.withDescription(
          'The ID of the customer in your system to create the subscription for. It must already exist in Polar.',
        ),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        metadata: config.input.metadata,
        product_id: config.input.product_id,
        customer_id: config.input.customer_id,
        external_customer_id: config.input.external_customer_id,
      })
      const missing = missingFlags(body, ['product_id'])
      if (missing.length > 0) {
        return yield* new ApiCommandError({
          message: `Missing required ${missing.length > 1 ? 'flags' : 'flag'} ${missing.join(', ')}`,
          hint: 'Example: polar subscriptions create --product-id d8dd2de1-21b7-4a41-8bc3-ce909c0cfe23',
        })
      }
      yield* api.execute({
        operationId: 'subscriptions:create',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        fields: config.fields,
        invoke: (client) => client.subscriptions.create(body),
      })
    }),
).pipe(Command.withDescription('Create a subscription programmatically.'))
