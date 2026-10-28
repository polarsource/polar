import type { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import {
  describePrice,
  findProduct,
  flattenFormErrors,
  normalizeState,
} from './webmcp'

describe('findProduct', () => {
  const checkout = {
    products: [
      { id: 'prod_monthly', name: 'Pro' },
      { id: 'prod_yearly', name: 'Pro Yearly' },
    ],
  } as unknown as schemas['CheckoutPublic']

  it('finds a product by ID', () => {
    expect(findProduct(checkout, 'prod_yearly')?.name).toBe('Pro Yearly')
  })

  it('finds a product by name, ignoring case', () => {
    expect(findProduct(checkout, ' pro yearly ')?.id).toBe('prod_yearly')
  })

  it('returns undefined for an unknown product', () => {
    expect(findProduct(checkout, 'yearly')).toBeUndefined()
  })
})

describe('describePrice', () => {
  it('describes a fixed price', () => {
    expect(
      describePrice({
        amount_type: 'fixed',
        price_amount: 2000,
      } as schemas['ProductPrice']),
    ).toEqual({ type: 'fixed', amount: 2000 })
  })

  it('describes a pay-what-you-want price with its limits', () => {
    expect(
      describePrice({
        amount_type: 'custom',
        minimum_amount: 500,
        maximum_amount: null,
        preset_amount: 1000,
      } as schemas['ProductPrice']),
    ).toEqual({
      type: 'pay_what_you_want',
      minimum: 500,
      maximum: null,
      preset: 1000,
    })
  })

  it('describes a seat-based price by its first tier', () => {
    expect(
      describePrice({
        amount_type: 'seat_based',
        tiers: { type: 'volume', tiers: [{ unit_amount: '1000' }] },
      } as unknown as schemas['ProductPrice']),
    ).toEqual({ type: 'per_seat', price_per_seat: 1000 })
  })

  it('returns null without a price', () => {
    expect(describePrice(undefined)).toBeNull()
  })
})

describe('normalizeState', () => {
  it('maps a bare code to the prefixed code for countries with fixed states', () => {
    expect(normalizeState('US', 'CA')).toBe('US-CA')
  })

  it('keeps an already prefixed code', () => {
    expect(normalizeState('US', 'us-ca')).toBe('US-CA')
  })

  it('maps a state name to its code', () => {
    expect(normalizeState('US', 'california')).toBe('US-CA')
  })

  it('leaves free-text states untouched', () => {
    expect(normalizeState('DE', 'Bavaria')).toBe('Bavaria')
  })

  it('leaves unknown states untouched', () => {
    expect(normalizeState('US', 'Atlantis')).toBe('Atlantis')
  })
})

describe('flattenFormErrors', () => {
  it('flattens nested errors into dotted paths', () => {
    expect(
      flattenFormErrors({
        customer_email: { type: 'required', message: 'Required' },
        customer_billing_address: {
          line1: { type: 'required', message: 'Line 1 is required' },
        },
      }),
    ).toEqual({
      customer_email: 'Required',
      'customer_billing_address.line1': 'Line 1 is required',
    })
  })
})
