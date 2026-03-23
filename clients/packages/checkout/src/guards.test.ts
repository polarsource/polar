import type { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { hasProductCheckout, isLegacyRecurringProductPrice } from './guards'

describe('hasProductCheckout', () => {
  const baseCheckout = {
    id: 'checkout_1',
    status: 'open',
    amount: 1000,
    currency: 'usd',
  } as schemas['CheckoutPublic']

  it('returns true when product and prices are present', () => {
    const checkout = {
      ...baseCheckout,
      product: { id: 'prod_1', name: 'Test' },
      prices: { prod_1: [] },
    } as unknown as schemas['CheckoutPublic']

    expect(hasProductCheckout(checkout)).toBe(true)
  })

  it('returns false when product is null', () => {
    const checkout = {
      ...baseCheckout,
      product: null,
      prices: { prod_1: [] },
    } as unknown as schemas['CheckoutPublic']

    expect(hasProductCheckout(checkout)).toBe(false)
  })

  it('returns false when prices is null', () => {
    const checkout = {
      ...baseCheckout,
      product: { id: 'prod_1', name: 'Test' },
      prices: null,
    } as unknown as schemas['CheckoutPublic']

    expect(hasProductCheckout(checkout)).toBe(false)
  })

  it('returns false when both product and prices are null', () => {
    const checkout = {
      ...baseCheckout,
      product: null,
      prices: null,
    } as unknown as schemas['CheckoutPublic']

    expect(hasProductCheckout(checkout)).toBe(false)
  })
})

describe('isLegacyRecurringProductPrice', () => {
  it('returns true for legacy recurring price', () => {
    const price = {
      type: 'recurring',
      legacy: true,
      recurring_interval: 'month',
    } as schemas['LegacyRecurringProductPrice']

    expect(isLegacyRecurringProductPrice(price)).toBe(true)
  })

  it('returns false for non-legacy price', () => {
    const price = {
      type: 'one_time',
      amount_type: 'fixed',
    } as unknown as schemas['ProductPrice']

    expect(isLegacyRecurringProductPrice(price)).toBe(false)
  })
})
