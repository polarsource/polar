// Generated from refunds:create (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect, Schema } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime, ApiCommandError } from '../runtime'
import { confirm, data, mergeInput, jsonFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['refunds']['create']>[0]>

export const command = Command.make(
  'create',
  {
    confirm,
    data,
    input: {
      metadata: jsonFlag('metadata').pipe(
        Flag.optional,
        Flag.withDescription(
          'Key-value object allowing you to store additional information.',
        ),
      ),
      order_id: Flag.string('order-id').pipe(
        Flag.optional,
        Flag.withDescription('order_id'),
      ),
      reason: Flag.choice('reason', [
        'duplicate',
        'fraudulent',
        'customer_request',
        'service_disruption',
        'satisfaction_guarantee',
        'other',
      ]).pipe(Flag.optional, Flag.withDescription('Reason for the refund.')),
      amount: Flag.integer('amount').pipe(
        Flag.optional,
        Flag.withDescription('Amount to refund in cents. Minimum is 1.'),
      ),
      comment: Flag.string('comment').pipe(
        Flag.optional,
        Flag.withDescription('An internal comment about the refund.'),
      ),
      revoke_benefits: Flag.boolean('revoke-benefits').pipe(
        Flag.optional,
        Flag.withDescription(
          'Should this refund trigger the associated customer benefits to be revoked?',
        ),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        metadata: config.input.metadata,
        order_id: config.input.order_id,
        reason: config.input.reason,
        amount: config.input.amount,
        comment: config.input.comment,
        revoke_benefits: config.input.revoke_benefits,
      })
      const confirmationInput = yield* Schema.decodeUnknownEffect(
        Schema.Struct({
          revoke_benefits: Schema.optionalKey(Schema.Boolean),
        }),
      )(body).pipe(
        Effect.mapError(
          (error) => new ApiCommandError({ message: error.message }),
        ),
      )
      yield* api.execute({
        operationId: 'refunds:create',
        method: 'POST',
        requiresConfirmation: confirmationInput['revoke_benefits'] === true,
        confirm: config.confirm,
        invoke: (client) => client.refunds.create(body),
      })
    }),
).pipe(Command.withDescription('Create a refund.'))
