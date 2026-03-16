import type { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import {
  getMeteredPrices,
  hasLegacyRecurringPrices,
  isLegacyRecurringPrice,
  isMeteredPrice,
} from './product'

const makePrice = (
  overrides: Partial<schemas['ProductPrice']>,
): schemas['ProductPrice'] =>
  ({
    id: 'price_1',
    amount_type: 'fixed',
    price_currency: 'usd',
    price_amount: 1000,
    ...overrides,
  }) as schemas['ProductPrice']

const makeLegacyPrice = (): schemas['LegacyRecurringProductPrice'] =>
  ({
    id: 'price_legacy',
    legacy: true,
    amount_type: 'fixed',
    price_currency: 'usd',
    price_amount: 500,
    recurring_interval: 'month',
  }) as schemas['LegacyRecurringProductPrice']

const makeMeteredPrice = (
  overrides?: Partial<schemas['ProductPriceMeteredUnit']>,
): schemas['ProductPriceMeteredUnit'] =>
  ({
    id: 'price_metered',
    amount_type: 'metered_unit',
    price_currency: 'usd',
    unit_amount: '100',
    cap_amount: null,
    meter: { id: 'm_1', name: 'API calls' },
    ...overrides,
  }) as schemas['ProductPriceMeteredUnit']

describe('isLegacyRecurringPrice', () => {
  it('returns true for legacy prices', () => {
    expect(isLegacyRecurringPrice(makeLegacyPrice())).toBe(true)
  })

  it('returns false for non-legacy prices', () => {
    expect(isLegacyRecurringPrice(makePrice({}))).toBe(false)
  })
})

describe('hasLegacyRecurringPrices', () => {
  it('returns true when array contains a legacy price', () => {
    // Legacy prices satisfy the ProductPrice union too for this test
    const prices = [makeLegacyPrice()] as unknown as schemas['ProductPrice'][]
    expect(hasLegacyRecurringPrices(prices)).toBe(true)
  })

  it('returns false when array has no legacy prices', () => {
    const prices = [makePrice({})]
    expect(hasLegacyRecurringPrices(prices)).toBe(false)
  })

  it('returns false for empty array', () => {
    expect(hasLegacyRecurringPrices([])).toBe(false)
  })
})

describe('isMeteredPrice', () => {
  it('returns true for metered unit prices', () => {
    expect(isMeteredPrice(makeMeteredPrice())).toBe(true)
  })

  it('returns false for fixed prices', () => {
    expect(isMeteredPrice(makePrice({ amount_type: 'fixed' }))).toBe(false)
  })
})

describe('getMeteredPrices', () => {
  it('filters to only metered prices', () => {
    const prices = [
      makePrice({}),
      makeMeteredPrice(),
    ] as schemas['ProductPrice'][]

    const result = getMeteredPrices(prices)
    expect(result).toHaveLength(1)
    expect(result[0].amount_type).toBe('metered_unit')
  })

  it('filters by currency when provided', () => {
    const usdMetered = makeMeteredPrice({ price_currency: 'usd' })
    const eurMetered = makeMeteredPrice({
      id: 'price_metered_eur',
      price_currency: 'eur',
    })
    const prices = [usdMetered, eurMetered] as schemas['ProductPrice'][]

    const result = getMeteredPrices(prices, 'usd')
    expect(result).toHaveLength(1)
    expect(result[0].price_currency).toBe('usd')
  })

  it('returns all metered prices when no currency filter', () => {
    const usdMetered = makeMeteredPrice({ price_currency: 'usd' })
    const eurMetered = makeMeteredPrice({
      id: 'price_metered_eur',
      price_currency: 'eur',
    })
    const prices = [usdMetered, eurMetered] as schemas['ProductPrice'][]

    const result = getMeteredPrices(prices)
    expect(result).toHaveLength(2)
  })

  it('returns empty array when no metered prices', () => {
    const prices = [makePrice({})]
    expect(getMeteredPrices(prices)).toHaveLength(0)
  })
})
