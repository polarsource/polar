// Generated from refunds:list (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput } from '../inputs'

type Query = NonNullable<Parameters<Polar['refunds']['list']>[0]>

export const command = Command.make(
  'list',
  {
    data,
    input: {
      id: Flag.string('id')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by refund ID.')),
      organization_id: Flag.string('organization-id')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.withAlias('org'),
          Flag.optional,
          Flag.withDescription('Filter by organization ID.'),
        ),
      order_id: Flag.string('order-id')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by order ID.')),
      subscription_id: Flag.string('subscription-id')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription('Filter by subscription ID.'),
        ),
      customer_id: Flag.string('customer-id')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by customer ID.')),
      external_customer_id: Flag.string('external-customer-id')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription('Filter by customer external ID.'),
        ),
      succeeded: Flag.boolean('succeeded').pipe(
        Flag.optional,
        Flag.withDescription('Filter by `succeeded`.'),
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
        'created_at',
        '-created_at',
        'amount',
        '-amount',
      ])
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription(
            'Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.',
          ),
        ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const query = mergeInput<Query>(config.data, {
        id: config.input.id,
        organization_id: config.input.organization_id,
        order_id: config.input.order_id,
        subscription_id: config.input.subscription_id,
        customer_id: config.input.customer_id,
        external_customer_id: config.input.external_customer_id,
        succeeded: config.input.succeeded,
        page: config.input.page,
        limit: config.input.limit,
        sorting: config.input.sorting,
      })
      yield* api.execute({
        operationId: 'refunds:list',
        method: 'GET',
        confirm: false,
        invoke: (client) => client.refunds.list(query),
      })
    }),
).pipe(Command.withDescription('List refunds.'))
