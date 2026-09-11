// Generated from subscriptions:list (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag } from '../inputs'

type Query = NonNullable<Parameters<Polar['subscriptions']['list']>[0]>

export const command = Command.make(
  'list',
  {
    data,
    input: {
      organization_id: Flag.string('organization-id')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.withAlias('org'),
          Flag.optional,
          Flag.withDescription('Filter by organization ID.'),
        ),
      product_id: Flag.string('product-id')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by product ID.')),
      customer_id: Flag.string('customer-id')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by customer ID.')),
      external_customer_id: Flag.string('external-customer-id')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription('Filter by customer external ID.'),
        ),
      discount_id: Flag.string('discount-id')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by discount ID.')),
      active: Flag.boolean('active').pipe(
        Flag.optional,
        Flag.withDescription('Filter by active or inactive subscription.'),
      ),
      status: Flag.choice('status', [
        'incomplete',
        'incomplete_expired',
        'trialing',
        'active',
        'past_due',
        'canceled',
        'unpaid',
        'paused',
      ])
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription('Filter by subscription status.'),
        ),
      cancel_at_period_end: Flag.boolean('cancel-at-period-end').pipe(
        Flag.optional,
        Flag.withDescription(
          'Filter by subscriptions that are set to cancel at period end.',
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
      )
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription('Filter by customer cancellation reason.'),
        ),
      canceled_at_after: Flag.string('canceled-at-after').pipe(
        Flag.optional,
        Flag.withDescription(
          'Filter by cancellation date (after or equal to).',
        ),
      ),
      canceled_at_before: Flag.string('canceled-at-before').pipe(
        Flag.optional,
        Flag.withDescription(
          'Filter by cancellation date (before or equal to).',
        ),
      ),
      started_after: Flag.string('started-after').pipe(
        Flag.optional,
        Flag.withDescription(
          'Only include subscriptions started after this date.',
        ),
      ),
      started_before: Flag.string('started-before').pipe(
        Flag.optional,
        Flag.withDescription(
          'Only include subscriptions started before this date.',
        ),
      ),
      page: Flag.integer('page').pipe(
        Flag.optional,
        Flag.withDescription('Page number, defaults to 1.'),
      ),
      limit: Flag.integer('limit').pipe(
        Flag.optional,
        Flag.withDescription('Size of a page, defaults to 10. Maximum is 100.'),
      ),
      sorting: Flag.choice('sorting', [
        'customer',
        '-customer',
        'status',
        '-status',
        'started_at',
        '-started_at',
        'current_period_end',
        '-current_period_end',
        'ended_at',
        '-ended_at',
        'ends_at',
        '-ends_at',
        'amount',
        '-amount',
        'product',
        '-product',
        'discount',
        '-discount',
      ])
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription(
            'Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.',
          ),
        ),
      metadata: jsonFlag('metadata').pipe(
        Flag.optional,
        Flag.withDescription(
          'Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.',
        ),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const query = mergeInput<Query>(config.data, {
        organization_id: config.input.organization_id,
        product_id: config.input.product_id,
        customer_id: config.input.customer_id,
        external_customer_id: config.input.external_customer_id,
        discount_id: config.input.discount_id,
        active: config.input.active,
        status: config.input.status,
        cancel_at_period_end: config.input.cancel_at_period_end,
        customer_cancellation_reason: config.input.customer_cancellation_reason,
        canceled_at_after: config.input.canceled_at_after,
        canceled_at_before: config.input.canceled_at_before,
        started_after: config.input.started_after,
        started_before: config.input.started_before,
        page: config.input.page,
        limit: config.input.limit,
        sorting: config.input.sorting,
        metadata: config.input.metadata,
      })
      yield* api.execute({
        operationId: 'subscriptions:list',
        method: 'GET',
        confirm: false,
        invoke: (client) => client.subscriptions.list(query),
      })
    }),
).pipe(Command.withDescription('List subscriptions.'))
