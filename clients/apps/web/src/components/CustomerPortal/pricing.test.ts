import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { getCustomerSubscriptionBasePrice } from './pricing'

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
