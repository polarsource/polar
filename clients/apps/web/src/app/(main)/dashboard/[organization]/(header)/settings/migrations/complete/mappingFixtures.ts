import { schemas } from '@polar-sh/client'
import { MappingSources } from './mappingTypes'

type Item = schemas['MerchantMigrationRecordItem']

const item = (overrides: Partial<Item>): Item =>
  ({
    record_id: null,
    entity: 'customers',
    source_id: 'x',
    title: 'x',
    subtitle: null,
    status: 'importable',
    import_status: 'imported',
    cutover_status: null,
    cutover_error: null,
    reason: null,
    ...overrides,
  }) as Item

export const sources = (): MappingSources => ({
  records: {
    customers: [
      item({ source_id: 'cus_ada', title: 'ada@example.com' }),
      item({ source_id: 'cus_bob', title: 'bob@example.com' }),
      item({
        source_id: 'cus_eve',
        title: 'eve@example.com',
        import_status: 'skipped',
      }),
    ],
    products: [
      item({
        entity: 'products',
        source_id: 'prod_pro',
        title: 'Pro',
        subtitle: 'Every month',
        recurring_interval: 'month',
        recurring_interval_count: 1,
      }),
      item({
        entity: 'products',
        source_id: 'prod_pro',
        title: 'Pro',
        subtitle: 'Every year',
        recurring_interval: 'year',
        recurring_interval_count: 1,
      }),
    ],
    prices: [
      item({
        entity: 'prices',
        source_id: 'price_pro_m',
        title: 'Pro',
        product_name: 'Pro',
        product_source_id: 'prod_pro',
        amount: 2900,
        currency: 'usd',
        recurring_interval: 'month',
        recurring_interval_count: 1,
      }),
    ],
    discounts: [
      item({ entity: 'discounts', source_id: 'LAUNCH20', title: 'Launch' }),
    ],
    subscriptions: [
      item({
        entity: 'subscriptions',
        source_id: 'sub_ada',
        title: 'ada@example.com',
        customer_source_id: 'cus_ada',
        product_source_id: 'prod_pro',
        cutover_status: 'moved',
      }),
      item({
        entity: 'subscriptions',
        source_id: 'sub_bob',
        title: 'bob@example.com',
        customer_source_id: 'cus_bob',
        product_source_id: 'prod_pro',
        import_status: 'pending',
        cutover_status: 'skipped',
        cutover_error: 'Renews too soon',
      }),
    ],
  },
  subscriptions: [
    {
      id: 'pol_sub_ada',
      created_at: '2026-09-28T10:00:00Z',
      customer: { id: 'pol_cus_ada' },
      product: {
        id: 'pol_prod_m',
        recurring_interval: 'month',
        recurring_interval_count: 1,
      },
      metadata: { provider: 'stripe', provider_subscription_id: 'sub_ada' },
    },
  ],
  customers: [
    { id: 'pol_cus_ada', email: 'ada@example.com' },
    { id: 'pol_cus_bob', email: 'Bob@Example.com' },
  ],
  products: [
    {
      id: 'pol_prod_m',
      name: 'Pro',
      recurring_interval: 'month',
      recurring_interval_count: 1,
      prices: [
        {
          id: 'pol_price_m',
          amount_type: 'fixed',
          price_amount: 2900,
          price_currency: 'usd',
        },
      ],
    },
    {
      id: 'pol_prod_y',
      name: 'Pro',
      recurring_interval: 'year',
      recurring_interval_count: 1,
      prices: [],
    },
  ],
  discounts: [{ id: 'pol_disc', metadata: { stripe_coupon_id: 'LAUNCH20' } }],
})
