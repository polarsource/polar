import { describe, expect, it } from 'vitest'
import { buildIdMapping } from './idMapping'
import { sources } from './mappingFixtures'
import { mappingCsv, mappingEntries } from './mappingExport'
import { kindForStripeId, lookupStripeIds, matchesQuery } from './mappingSearch'

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
