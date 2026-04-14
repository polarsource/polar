import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import {
  getCustomerSubscriptionBasePrice,
  getPendingTotalAmount,
} from './pricing'

const createFixedPrice = (
  currency: string,
  amount: number,
): schemas['ProductPriceFixed'] =>
  ({
    id: `price-${currency}`,
    created_at: '2026-04-10T00:00:00Z',
    modified_at: null,
    source: 'catalog',
    amount_type: 'fixed',
    price_currency: currency,
    tax_behavior: null,
    is_archived: false,
    product_id: 'product-1',
    price_amount: amount,
  }) as schemas['ProductPriceFixed']

const createCustomPrice = (currency: string): schemas['ProductPriceCustom'] =>
  ({
    id: `price-custom-${currency}`,
    created_at: '2026-04-10T00:00:00Z',
    modified_at: null,
    source: 'catalog',
    amount_type: 'custom',
    price_currency: currency,
    tax_behavior: null,
    is_archived: false,
    product_id: 'product-1',
    minimum_amount: 500,
    maximum_amount: null,
    preset_amount: 1500,
  }) as schemas['ProductPriceCustom']

const createSubscription = (
  currency: string,
  prices: schemas['CustomerSubscriptionProduct']['prices'],
): schemas['CustomerSubscription'] =>
  ({
    created_at: '2026-04-10T00:00:00Z',
    modified_at: null,
    id: 'subscription-1',
    amount: 35440,
    currency,
    recurring_interval: 'month',
    recurring_interval_count: 1,
    status: 'active',
    current_period_start: '2026-04-10T00:00:00Z',
    current_period_end: '2026-05-10T00:00:00Z',
    trial_start: null,
    trial_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    started_at: '2026-04-10T00:00:00Z',
    ends_at: null,
    ended_at: null,
    customer_id: 'customer-1',
    product_id: 'product-1',
    discount_id: null,
    checkout_id: null,
    customer_cancellation_reason: null,
    customer_cancellation_comment: null,
    product: {
      id: 'product-1',
      created_at: '2026-04-10T00:00:00Z',
      modified_at: null,
      trial_interval: null,
      trial_interval_count: null,
      name: 'Essential',
      description: null,
      visibility: 'public',
      recurring_interval: 'month',
      recurring_interval_count: 1,
      is_recurring: true,
      is_archived: false,
      organization_id: 'org-1',
      prices,
      benefits: [],
      medias: [],
      organization: {
        created_at: '2026-04-10T00:00:00Z',
        modified_at: null,
        id: 'org-1',
        slug: 'org',
        name: 'Org',
        avatar_url: null,
        proration_behavior: 'prorate',
        allow_customer_updates: true,
        customer_portal_settings: {
          subscription: {
            cancellation: {
              enabled: true,
              allow_multiple: true,
              mode: 'at_period_end',
            },
            update_plan: true,
          },
        },
      },
    },
    prices: [],
    meters: [],
    pending_update: null,
  }) as unknown as schemas['CustomerSubscription']

describe('getCustomerSubscriptionBasePrice', () => {
  it('uses the catalog price matching the subscription currency', () => {
    const subscription = createSubscription('dkk', [
      createFixedPrice('usd', 5400),
      createFixedPrice('dkk', 35440),
    ])

    expect(getCustomerSubscriptionBasePrice(subscription)).toEqual({
      amount: 35440,
      currency: 'dkk',
    })
  })

  it('skips the base price when no catalog price matches the subscription currency', () => {
    const subscription = createSubscription('dkk', [
      createFixedPrice('usd', 5400),
    ])

    expect(getCustomerSubscriptionBasePrice(subscription)).toBeNull()
  })

  it('skips the base price when the matching catalog price is custom', () => {
    const subscription = createSubscription('dkk', [createCustomPrice('dkk')])

    expect(getCustomerSubscriptionBasePrice(subscription)).toBeNull()
  })
})

const createProduct = (prices: schemas['ProductPrice'][]): schemas['Product'] =>
  ({
    id: 'product-2',
    created_at: '2026-04-10T00:00:00Z',
    modified_at: null,
    name: 'Pro',
    description: null,
    recurring_interval: 'month',
    recurring_interval_count: 1,
    is_recurring: true,
    is_archived: false,
    organization_id: 'org-1',
    prices,
    benefits: [],
    medias: [],
  }) as unknown as schemas['Product']

const createSeatBasedPrice = (
  currency: string,
  tiers: {
    min_seats: number
    max_seats?: number | null
    price_per_seat: number
  }[],
): schemas['ProductPriceSeatBased'] =>
  ({
    id: `price-seat-${currency}`,
    created_at: '2026-04-10T00:00:00Z',
    modified_at: null,
    source: 'catalog',
    amount_type: 'seat_based',
    price_currency: currency,
    tax_behavior: null,
    is_archived: false,
    product_id: 'product-2',
    seat_tiers: { tiers },
  }) as schemas['ProductPriceSeatBased']

describe('getPendingTotalAmount', () => {
  it('returns the fixed price amount for a fixed-price product', () => {
    const product = createProduct([createFixedPrice('usd', 9900)])
    expect(getPendingTotalAmount(product, 'usd', 1)).toBe(9900)
  })

  it('returns null when no price matches the currency', () => {
    const product = createProduct([createFixedPrice('usd', 9900)])
    expect(getPendingTotalAmount(product, 'eur', 1)).toBeNull()
  })

  it('returns null for custom price products', () => {
    const product = createProduct([createCustomPrice('usd')])
    expect(getPendingTotalAmount(product, 'usd', 1)).toBeNull()
  })

  it('calculates total for single-tier seat-based pricing', () => {
    const product = createProduct([
      createSeatBasedPrice('usd', [
        { min_seats: 1, max_seats: null, price_per_seat: 1000 },
      ]),
    ])
    expect(getPendingTotalAmount(product, 'usd', 5)).toBe(5000)
  })

  it('calculates total for multi-tier seat-based pricing', () => {
    const product = createProduct([
      createSeatBasedPrice('usd', [
        { min_seats: 1, max_seats: 5, price_per_seat: 1000 },
        { min_seats: 6, max_seats: 10, price_per_seat: 800 },
        { min_seats: 11, max_seats: null, price_per_seat: 600 },
      ]),
    ])

    // 3 seats: all in first tier
    expect(getPendingTotalAmount(product, 'usd', 3)).toBe(3000)

    // 5 seats: exactly fills first tier
    expect(getPendingTotalAmount(product, 'usd', 5)).toBe(5000)

    // 7 seats: 5 × 1000 + 2 × 800
    expect(getPendingTotalAmount(product, 'usd', 7)).toBe(6600)

    // 10 seats: 5 × 1000 + 5 × 800
    expect(getPendingTotalAmount(product, 'usd', 10)).toBe(9000)

    // 15 seats: 5 × 1000 + 5 × 800 + 5 × 600
    expect(getPendingTotalAmount(product, 'usd', 15)).toBe(12000)
  })

  it('returns null for a product with no prices', () => {
    const product = createProduct([])
    expect(getPendingTotalAmount(product, 'usd', 1)).toBeNull()
  })
})
