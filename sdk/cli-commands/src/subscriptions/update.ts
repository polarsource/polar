// Generated from subscriptions:update (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect, Schema } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime, ApiCommandError } from '../runtime'
import { confirm, data, mergeInput, jsonFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['subscriptions']['update']>[1]>

export const command = Command.make(
  'update',
  {
    confirm,
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
      product_id: Flag.string('product-id').pipe(
        Flag.optional,
        Flag.withDescription('Update subscription to another product.'),
      ),
      proration_behavior: Flag.choice('proration-behavior', [
        'invoice',
        'prorate',
        'next_period',
        'reset',
      ]).pipe(
        Flag.optional,
        Flag.withDescription(
          'Determine how to handle the proration billing. If not provided, will use the default organization setting.',
        ),
      ),
      discount_id: Flag.string('discount-id').pipe(
        Flag.optional,
        Flag.withDescription(
          'Update the subscription to apply a new discount. If set to `null`, the discount will be removed. The change will be applied on the next billing cycle.',
        ),
      ),
      trial_end: jsonFlag('trial-end').pipe(
        Flag.optional,
        Flag.withDescription(
          'Set or extend the trial period of the subscription. If set to `now`, the trial will end immediately.',
        ),
      ),
      seats: Flag.integer('seats').pipe(
        Flag.optional,
        Flag.withDescription(
          'Update the number of seats for this subscription.',
        ),
      ),
      units: Flag.integer('units').pipe(
        Flag.optional,
        Flag.withDescription(
          'Update the number of units for this subscription.',
        ),
      ),
      current_billing_period_end: Flag.string(
        'current-billing-period-end',
      ).pipe(
        Flag.optional,
        Flag.withDescription(
          "Set a new date for the end of the current billing period. The subscription will renew on this date. The new date can be earlier or later than the current period end, as long as it's in the future.",
        ),
      ),
      customer_cancellation_reason: Flag.choice(
        'customer-cancellation-reason',
        [
          'customer_service',
          'low_quality',
          'missing_features',
          'switched_service',
          'too_complex',
          'too_expensive',
          'unused',
          'other',
        ],
      ).pipe(
        Flag.optional,
        Flag.withDescription('Customer reason for cancellation.'),
      ),
      customer_cancellation_comment: Flag.string(
        'customer-cancellation-comment',
      ).pipe(
        Flag.optional,
        Flag.withDescription(
          'Customer feedback and why they decided to cancel.',
        ),
      ),
      cancel_at_period_end: Flag.boolean('cancel-at-period-end').pipe(
        Flag.optional,
        Flag.withDescription(
          'Cancel an active subscription once the current period ends.',
        ),
      ),
      revoke: jsonFlag('revoke').pipe(
        Flag.optional,
        Flag.withDescription(
          'Cancel and revoke an active subscription immediately',
        ),
      ),
      pause_at_period_end: Flag.boolean('pause-at-period-end').pipe(
        Flag.optional,
        Flag.withDescription(
          'Pause an active subscription at the end of the current period.',
        ),
      ),
      resumes_at: Flag.string('resumes-at').pipe(
        Flag.optional,
        Flag.withDescription(
          'Date at which the paused subscription should automatically resume.',
        ),
      ),
      resume: jsonFlag('resume').pipe(
        Flag.optional,
        Flag.withDescription(
          'Resume a paused subscription immediately, starting a new billing period and charging the customer.',
        ),
      ),
      pending_update: jsonFlag('pending-update').pipe(
        Flag.optional,
        Flag.withDescription(
          'Clear the pending subscription update. Set to null to remove scheduled changes.',
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
        proration_behavior: config.input.proration_behavior,
        discount_id: config.input.discount_id,
        trial_end: config.input.trial_end,
        seats: config.input.seats,
        units: config.input.units,
        current_billing_period_end: config.input.current_billing_period_end,
        customer_cancellation_reason: config.input.customer_cancellation_reason,
        customer_cancellation_comment:
          config.input.customer_cancellation_comment,
        cancel_at_period_end: config.input.cancel_at_period_end,
        revoke: config.input.revoke,
        pause_at_period_end: config.input.pause_at_period_end,
        resumes_at: config.input.resumes_at,
        resume: config.input.resume,
        pending_update: config.input.pending_update,
      })
      const confirmationInput = yield* Schema.decodeUnknownEffect(
        Schema.Struct({
          cancel_at_period_end: Schema.optionalKey(Schema.Boolean),
          revoke: Schema.optionalKey(Schema.Literal(true)),
          pause_at_period_end: Schema.optionalKey(Schema.Boolean),
        }),
      )(body).pipe(
        Effect.mapError(
          (error) => new ApiCommandError({ message: error.message }),
        ),
      )
      yield* api.execute({
        operationId: 'subscriptions:update',
        method: 'PATCH',
        requiresConfirmation:
          confirmationInput['cancel_at_period_end'] === true ||
          confirmationInput['revoke'] === true ||
          confirmationInput['pause_at_period_end'] === true,
        confirm: config.confirm,
        preview: {
          fields: [
            { key: 'id', label: 'ID' },
            { key: 'status', label: 'Status' },
            { key: 'customer_id', label: 'Customer ID' },
            { key: 'product_id', label: 'Product ID' },
          ],
          invoke: (client) => client.subscriptions.get(config.path.id),
        },
        invoke: (client) => client.subscriptions.update(config.path.id, body),
      })
    }),
).pipe(Command.withDescription('Update a subscription.'))
