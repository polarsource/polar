import { useCustomerSubscriptionChargePreview } from '@/hooks/queries/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CurrentPeriodOverview } from './CurrentPeriodOverview'

vi.mock('@/hooks/queries/customerPortal', () => ({
  useCustomerSubscriptionChargePreview: vi.fn(),
}))

const createSeatPrice = (amount: number): schemas['ProductPriceSeatBased'] =>
  ({
    amount_type: 'seat_based',
    price_currency: 'usd',
    seat_tiers: {
      seat_tier_type: 'volume',
      tiers: [{ min_seats: 1, max_seats: null, price_per_seat: amount }],
    },
  }) as schemas['ProductPriceSeatBased']

const createProduct = (
  id: string,
  price: schemas['ProductPriceSeatBased'],
): schemas['CustomerProduct'] =>
  ({
    id,
    name: 'Team plan',
    recurring_interval: 'month',
    recurring_interval_count: 1,
    prices: [price],
  }) as schemas['CustomerProduct']

const createSubscription = (
  price: schemas['ProductPriceSeatBased'],
  pendingProductId: string | null = null,
): schemas['CustomerSubscription'] =>
  ({
    id: 'subscription-1',
    amount: 5000,
    currency: 'usd',
    recurring_interval: 'month',
    recurring_interval_count: 1,
    status: 'active',
    current_period_end: '2026-09-13T00:00:00Z',
    cancel_at_period_end: false,
    ended_at: null,
    pause_at_period_end: false,
    resumes_at: null,
    product_id: 'product-1',
    seats: 2,
    prices: [price],
    meters: [],
    pending_update: pendingProductId
      ? { product_id: pendingProductId, seats: null }
      : null,
  }) as unknown as schemas['CustomerSubscription']

describe('CurrentPeriodOverview', () => {
  beforeEach(() => {
    vi.mocked(useCustomerSubscriptionChargePreview).mockReturnValue({
      data: {
        base_amount: 5000,
        metered_amount: 0,
        proration_amount: 0,
        prorations: [],
        subtotal_amount: 5000,
        discount_amount: 0,
        net_amount: 5000,
        tax_amount: 0,
        total_amount: 5000,
      },
    } as ReturnType<typeof useCustomerSubscriptionChargePreview>)
  })

  it('shows the locked total for the current seat-based product', () => {
    const lockedPrice = createSeatPrice(2500)
    const catalogPrice = createSeatPrice(2000)
    const subscription = createSubscription(lockedPrice)
    const { container } = render(
      <CurrentPeriodOverview
        subscription={subscription}
        products={[createProduct('product-1', catalogPrice)]}
        api={{} as Client}
      />,
    )

    expect(container.textContent).toContain(
      formatCurrency('compact')(5000, 'usd'),
    )
    expect(container.textContent).not.toContain(
      formatCurrency('compact')(2000, 'usd'),
    )
  })

  it('shows the catalog per-seat price for a pending product change', () => {
    const lockedPrice = createSeatPrice(2500)
    const upcomingPrice = createSeatPrice(3000)
    const subscription = createSubscription(lockedPrice, 'product-2')
    const { container } = render(
      <CurrentPeriodOverview
        subscription={subscription}
        products={[createProduct('product-2', upcomingPrice)]}
        api={{} as Client}
      />,
    )

    expect(container.textContent).toContain(
      formatCurrency('compact')(3000, 'usd'),
    )
    expect(container.textContent).not.toContain(
      formatCurrency('compact')(2500, 'usd'),
    )
  })
})
