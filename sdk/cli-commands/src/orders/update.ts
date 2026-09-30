// Generated from orders:update (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag, nullableStringFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['orders']['update']>[1]>

export const command = Command.make(
  'update',
  {
    path: {
      id: Argument.String('id'),
    },
    data,
    input: {
      billing_name: nullableStringFlag('billing-name').pipe(
        Flag.optional,
        Flag.withDescription(
          'The name of the customer that should appear on the invoice.',
        ),
      ),
      billing_address: jsonFlag('billing-address').pipe(
        Flag.optional,
        Flag.withDescription(
          'The address of the customer that should appear on the invoice. Country and state fields cannot be updated. JSON: {"country": "AD" | "AE" | "AF" | "AG" | "AI" | ..., ...}',
        ),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        billing_name: config.input.billing_name,
        billing_address: config.input.billing_address,
      })
      yield* api.execute({
        operationId: 'orders:update',
        method: 'PATCH',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) => client.orders.update(config.path.id, body),
      })
    }),
).pipe(Command.withDescription('Update an order.'))
