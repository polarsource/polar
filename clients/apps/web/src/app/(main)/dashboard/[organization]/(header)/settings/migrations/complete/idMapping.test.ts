import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { buildIdMapping } from './idMapping'
import { mappingCsv } from './mappingExport'

type Item = schemas['MerchantMigrationRecordItem']

const item = (
  entity: Item['entity'],
  source_id: string,
  extra: Partial<Item> = {},
) =>
  ({
    entity,
    source_id,
    title: source_id,
    import_status: 'imported',
    ...extra,
  }) as Item

const product = (interval: string) => ({
  product_source_id: 'prod_pro',
  product_name: 'Pro',
  recurring_interval: interval,
})
const subscription = (id: string, created_at: string) => ({
  id: `pol_${id}`,
  created_at,
  customer_id: 'pol_cus',
  product_id: 'pol_prod_m',
  metadata: { provider_subscription_id: id },
})

const mapping = buildIdMapping(
  {
    customers: [
      item('customers', 'cus_ada', { title: 'Ada@example.com' }),
      item('customers', 'cus_eve', { import_status: 'skipped' }),
    ],
    products: [
      item('products', 'prod_pro', product('month')),
      item('products', 'prod_pro', product('year')),
    ],
    prices: [
      item('prices', 'price_m', {
        ...product('month'),
        amount: 2900,
        currency: 'USD',
      }),
    ],
    discounts: [item('discounts', 'LAUNCH20')],
    subscriptions: [
      item('subscriptions', 'sub_moved', {
        ...product('month'),
        cutover_status: 'moved',
      }),
      item('subscriptions', 'sub_left', {
        import_status: 'pending',
        cutover_status: 'skipped',
      }),
      item('subscriptions', 'sub_ready', {
        import_status: 'pending',
        dependencies_imported: true,
      }),
    ],
  },
  {
    subscriptions: [subscription('sub_moved', '2026-09-28T10:00:00Z')],
    customers: [{ id: 'pol_cus_ada', email: 'ada@example.com' }],
    products: [
      {
        id: 'pol_prod_m',
        name: 'Pro',
        recurring_interval: 'month',
        prices: [
          { id: 'pol_price_m', price_amount: 2900, price_currency: 'usd' },
        ],
      },
      { id: 'pol_prod_y', name: 'Pro', recurring_interval: 'year', prices: [] },
    ],
    discounts: [{ id: 'pol_disc', metadata: { stripe_coupon_id: 'LAUNCH20' } }],
  },
)

const ids = (rows: { polarId: string | null; state: string }[]) =>
  rows.map((row) => [row.polarId, row.state])

describe('buildIdMapping', () => {
  it('maps customers by email and leaves skipped ones on Stripe', () => {
    expect(ids(mapping.customers)).toEqual([
      ['pol_cus_ada', 'in_polar'],
      [null, 'not_imported'],
    ])
  })

  it('maps a Stripe product split per interval to each Polar product, and its prices by amount', () => {
    expect(ids(mapping.products)).toEqual([
      ['pol_prod_m', 'in_polar'],
      ['pol_prod_y', 'in_polar'],
    ])
    expect(ids(mapping.prices)).toEqual([['pol_price_m', 'in_polar']])
  })

  it('maps discounts and switched subscriptions through their metadata', () => {
    expect(ids(mapping.discounts)).toEqual([['pol_disc', 'in_polar']])
    expect(ids(mapping.subscriptions)).toEqual([
      ['pol_sub_moved', 'moved'],
      [null, 'left_on_stripe'],
      [null, 'ready'],
    ])
  })

  it('dates a switched subscription by when Polar created it', () => {
    expect(mapping.subscriptions.map((row) => row.switchedAt)).toEqual([
      '2026-09-28T10:00:00Z',
      null,
      null,
    ])
  })
})

describe('mappingCsv', () => {
  it('writes a header and one row per record', () => {
    const lines = mappingCsv(mapping).trim().split('\n')
    expect(lines[0]).toBe('type,stripe_id,polar_id,name,detail,status')
    expect(lines).toContain('customers,cus_eve,,cus_eve,,not_imported')
    expect(lines).toHaveLength(1 + 2 + 2 + 1 + 1 + 3)
  })
})
