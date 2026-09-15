// Generated from customer-seats:list_seats (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput } from '../inputs'

type Query = NonNullable<Parameters<Polar['customerSeats']['listSeats']>[0]>

export const command = Command.make(
  'list_seats',
  {
    data,
    input: {
      subscription_id: Flag.string('subscription-id').pipe(
        Flag.optional,
        Flag.withDescription('subscription_id'),
      ),
      order_id: Flag.string('order-id').pipe(
        Flag.optional,
        Flag.withDescription('order_id'),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const query = mergeInput<Query>(config.data, {
        subscription_id: config.input.subscription_id,
        order_id: config.input.order_id,
      })
      yield* api.execute({
        operationId: 'customer-seats:list_seats',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) => client.customerSeats.listSeats(query),
      })
    }),
).pipe(Command.withDescription('**Scopes**: `customer_seats:read`'))
