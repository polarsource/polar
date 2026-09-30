// Generated from orders:list (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag, nullableStringFlag } from '../inputs'

type Query = NonNullable<Parameters<Polar['orders']['list']>[0]>

export const command = Command.make(
  'list',
  {
    data,
    input: {
      organization_id: Flag.String('organization-id')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.withAlias('org'),
          Flag.optional,
          Flag.withDescription(
            'Filter by organization ID. Defaults to the active organization.',
          ),
        ),
      product_id: Flag.String('product-id')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by product ID.')),
      product_billing_type: Flag.Literals('product-billing-type', [
        'one_time',
        'recurring',
      ])
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription(
            'Filter by product billing type. `recurring` will filter data corresponding to subscriptions creations or renewals. `one_time` will filter data corresponding to one-time purchases.',
          ),
        ),
      discount_id: Flag.String('discount-id')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by discount ID.')),
      customer_id: Flag.String('customer-id')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by customer ID.')),
      external_customer_id: Flag.String('external-customer-id')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription('Filter by customer external ID.'),
        ),
      checkout_id: Flag.String('checkout-id')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by checkout ID.')),
      subscription_id: Flag.String('subscription-id')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription('Filter by subscription ID.'),
        ),
      status: Flag.Literals('status', [
        'draft',
        'pending',
        'paid',
        'refunded',
        'partially_refunded',
        'void',
      ])
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by order status.')),
      created_after: nullableStringFlag('created-after').pipe(
        Flag.optional,
        Flag.withDescription('Only include orders created after this date'),
      ),
      created_before: nullableStringFlag('created-before').pipe(
        Flag.optional,
        Flag.withDescription('Only include orders created before this date'),
      ),
      page: Flag.Int('page').pipe(
        Flag.optional,
        Flag.withDescription('Page number, defaults to 1.'),
      ),
      limit: Flag.Int('limit').pipe(
        Flag.optional,
        Flag.withDescription('Size of a page, defaults to 10. Maximum is 100.'),
      ),
      sorting: Flag.Literals('sorting', [
        'created_at',
        '-created_at',
        'status',
        '-status',
        'invoice_number',
        '-invoice_number',
        'amount',
        '-amount',
        'net_amount',
        '-net_amount',
        'customer',
        '-customer',
        'product',
        '-product',
        'discount',
        '-discount',
        'subscription',
        '-subscription',
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
          'Filter by metadata key-value pairs. JSON: {"<key>": string | integer | boolean | array of string | array of integer | array of boolean}',
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
        product_billing_type: config.input.product_billing_type,
        discount_id: config.input.discount_id,
        customer_id: config.input.customer_id,
        external_customer_id: config.input.external_customer_id,
        checkout_id: config.input.checkout_id,
        subscription_id: config.input.subscription_id,
        status: config.input.status,
        created_after: config.input.created_after,
        created_before: config.input.created_before,
        page: config.input.page,
        limit: config.input.limit,
        sorting: config.input.sorting,
        metadata: config.input.metadata,
      })
      yield* api.execute({
        operationId: 'orders:list',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        organizationId: query.organization_id,
        invoke: (client) => client.orders.list(query),
      })
    }),
).pipe(Command.withDescription('List orders.'))
