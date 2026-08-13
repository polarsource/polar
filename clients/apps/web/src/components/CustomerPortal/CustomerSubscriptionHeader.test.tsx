import { render } from '@testing-library/react'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { describe, expect, it } from 'vitest'
import { CustomerSubscriptionHeader } from './CustomerSubscriptionHeader'

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

const createSubscription = (
  amount: number,
  catalogAmount: number,
): schemas['CustomerSubscription'] =>
  ({
    id: 'subscription-1',
    amount,
    currency: 'usd',
    recurring_interval: 'year',
    recurring_interval_count: 1,
    status: 'active',
    pending_update: null,
    product: {
      id: 'product-1',
      name: 'Notepad.exe - Annual',
      prices: [createFixedPrice('usd', catalogAmount)],
    },
    prices: [],
  }) as unknown as schemas['CustomerSubscription']

describe('CustomerSubscriptionHeader', () => {
  it('does not strike through the catalog price when the locked price is higher (price was lowered)', () => {
    // Subscriber is locked at $24.99; the product's current catalog price
    // dropped to $19.99. Striking $19.99 would read as a price increase.
    const { container } = render(
      <CustomerSubscriptionHeader
        subscription={createSubscription(2499, 1999)}
      />,
    )

    expect(container.querySelector('.line-through')).toBeNull()
    expect(container.textContent).toContain(
      formatCurrency('compact')(2499, 'usd'),
    )
    expect(container.textContent).not.toContain(
      formatCurrency('compact')(1999, 'usd'),
    )
  })

  it('strikes through the catalog price when the locked price is lower (genuine saving)', () => {
    // Subscriber is grandfathered/discounted at $19.99 while the catalog price
    // is $24.99 — surface the saving with the catalog price struck through.
    const { container } = render(
      <CustomerSubscriptionHeader
        subscription={createSubscription(1999, 2499)}
      />,
    )

    const struck = container.querySelector('.line-through')
    expect(struck?.textContent).toContain(
      formatCurrency('compact')(2499, 'usd'),
    )
    expect(container.textContent).toContain(
      formatCurrency('compact')(1999, 'usd'),
    )
  })

  it('does not strike through when the locked price matches the catalog price', () => {
    const { container } = render(
      <CustomerSubscriptionHeader
        subscription={createSubscription(2499, 2499)}
      />,
    )

    expect(container.querySelector('.line-through')).toBeNull()
  })
})
