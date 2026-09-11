// Generated from customer-seats:assign_seat (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['customerSeats']['assignSeat']>[0]>

export const command = Command.make(
  'assign_seat',
  {
    data,
    input: {
      subscription_id: Flag.string('subscription-id').pipe(
        Flag.optional,
        Flag.withDescription(
          'Subscription ID. Required if neither order_id nor checkout_id is provided.',
        ),
      ),
      order_id: Flag.string('order-id').pipe(
        Flag.optional,
        Flag.withDescription(
          'Order ID for one-time purchases. Required if subscription_id is not provided.',
        ),
      ),
      email: Flag.string('email').pipe(
        Flag.optional,
        Flag.withDescription('Email of the customer to assign the seat to'),
      ),
      external_customer_id: Flag.string('external-customer-id').pipe(
        Flag.optional,
        Flag.withDescription('External customer ID for the seat assignment'),
      ),
      customer_id: Flag.string('customer-id').pipe(
        Flag.optional,
        Flag.withDescription('Customer ID for the seat assignment'),
      ),
      external_member_id: Flag.string('external-member-id').pipe(
        Flag.optional,
        Flag.withDescription(
          'External member ID for the seat assignment. Can be used alone (lookup existing member) or with email (create/validate member).',
        ),
      ),
      member_id: Flag.string('member-id').pipe(
        Flag.optional,
        Flag.withDescription('Member ID for the seat assignment.'),
      ),
      metadata: jsonFlag('metadata').pipe(
        Flag.optional,
        Flag.withDescription(
          'Additional metadata for the seat (max 10 keys, 1KB total)',
        ),
      ),
      immediate_claim: Flag.boolean('immediate-claim').pipe(
        Flag.optional,
        Flag.withDescription(
          'If true, the seat will be immediately claimed without sending an invitation email. API-only feature.',
        ),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        subscription_id: config.input.subscription_id,
        order_id: config.input.order_id,
        email: config.input.email,
        external_customer_id: config.input.external_customer_id,
        customer_id: config.input.customer_id,
        external_member_id: config.input.external_member_id,
        member_id: config.input.member_id,
        metadata: config.input.metadata,
        immediate_claim: config.input.immediate_claim,
      })
      yield* api.execute({
        operationId: 'customer-seats:assign_seat',
        method: 'POST',
        confirm: false,
        invoke: (client) => client.customerSeats.assignSeat(body),
      })
    }),
).pipe(Command.withDescription('**Scopes**: `customer_seats:write`'))
