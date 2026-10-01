import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { buildIdMapping, MappingSources } from './idMapping'
import { mappingCsv, mappingEntries } from './mappingExport'
import { kindForStripeId, lookupStripeIds, matchesQuery } from './mappingSearch'

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

const sources = (): MappingSources => ({
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

describe('buildIdMapping', () => {
  const mapping = buildIdMapping(sources())

  it('maps subscriptions through provider_subscription_id metadata', () => {
    expect(
      mapping.subscriptions.map((row) => [row.polarId, row.state, row.note]),
    ).toEqual([
      ['pol_sub_ada', 'moved', null],
      [null, 'left_on_stripe', 'Renews too soon'],
    ])
  })

  it('maps customers by email, even when their subscription stayed on Stripe', () => {
    expect(mapping.customers.map((row) => [row.polarId, row.state])).toEqual([
      ['pol_cus_ada', 'in_polar'],
      ['pol_cus_bob', 'in_polar'],
      [null, 'not_imported'],
    ])
  })

  it('picks the Polar product per interval, falling back to a unique name match', () => {
    expect(mapping.products.map((row) => row.polarId)).toEqual([
      'pol_prod_m',
      'pol_prod_y',
    ])
  })

  it('maps prices by amount and currency on the mapped product', () => {
    expect(mapping.prices[0]).toMatchObject({
      polarId: 'pol_price_m',
      state: 'in_polar',
    })
  })

  it('maps discounts through stripe_coupon_id metadata', () => {
    expect(mapping.discounts[0].polarId).toBe('pol_disc')
  })
})

describe('search and lookup', () => {
  const mapping = buildIdMapping(sources())

  it('matches on either ID or the label', () => {
    const [ada] = mapping.customers
    expect(matchesQuery(ada, 'POL_CUS')).toBe(true)
    expect(matchesQuery(ada, 'cus_ada')).toBe(true)
    expect(matchesQuery(ada, 'bob')).toBe(false)
  })

  it('detects the kind from the Stripe prefix', () => {
    expect(kindForStripeId('sub_1')).toBe('subscriptions')
    expect(kindForStripeId('LAUNCH20')).toBeNull()
  })

  it('looks up several pasted IDs, coupons across every kind', () => {
    const results = lookupStripeIds(mapping, 'sub_ada, LAUNCH20\ncus_nope')
    expect(
      results.map((result) => result.rows.map((row) => row.polarId)),
    ).toEqual([['pol_sub_ada'], ['pol_disc'], []])
  })
})

describe('export', () => {
  const mapping = buildIdMapping(sources())

  it('writes one CSV row per record with a header', () => {
    const lines = mappingCsv(mapping).trim().split('\n')
    expect(lines[0]).toBe('type,stripe_id,polar_id,name,detail,status')
    expect(lines).toContain('customers,cus_eve,,eve@example.com,,not_imported')
    expect(lines).toHaveLength(1 + 3 + 2 + 1 + 1 + 2)
  })

  it('keeps every Polar product a split Stripe product became', () => {
    const products = mappingEntries(mapping).filter(
      (entry) => entry.stripe_id === 'prod_pro',
    )
    expect(products.map((entry) => [entry.polar_id, entry.detail])).toEqual([
      ['pol_prod_m', 'Every month'],
      ['pol_prod_y', 'Every year'],
    ])
  })
})
