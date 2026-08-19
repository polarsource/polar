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

const createFixedPrice = (amount: number): schemas['ProductPriceFixed'] =>
  ({
    amount_type: 'fixed',
    price_currency: 'usd',
    price_amount: amount,
  }) as schemas['ProductPriceFixed']

const createCustomPrice = (): schemas['ProductPriceCustom'] =>
  ({
    amount_type: 'custom',
    price_currency: 'usd',
    minimum_amount: 1000,
    maximum_amount: null,
    preset_amount: 2000,
  }) as schemas['ProductPriceCustom']

const createUnitPrice = (): schemas['ProductPriceUnitBased'] =>
  ({
    amount_type: 'unit_based',
    price_currency: 'usd',
    tiers: {
      type: 'volume',
      tiers: [{ bound: null, unit_amount: 2500 }],
    },
    minimum_units: 1,
    maximum_units: null,
    unit_label: { en: { '=1': 'device', other: 'devices' } },
  }) as unknown as schemas['ProductPriceUnitBased']

const createProduct = (
  id: string,
  price: schemas['ProductPrice'],
): schemas['CustomerProduct'] =>
  ({
    id,
    name: 'Team plan',
    recurring_interval: 'month',
    recurring_interval_count: 1,
    prices: [price],
  }) as schemas['CustomerProduct']

const createSubscription = (
  price: schemas['ProductPrice'],
  pendingProductId: string | null = null,
  amount = 5000,
): schemas['CustomerSubscription'] =>
  ({
    id: 'subscription-1',
    amount,
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

const mockChargePreview = (baseAmount: number) => {
  const preview: schemas['SubscriptionChargePreview'] = {
    base_amount: baseAmount,
    metered_amount: 0,
    proration_amount: 0,
    prorations: [],
    subtotal_amount: baseAmount,
    discount_amount: 0,
    net_amount: baseAmount,
    tax_amount: 0,
    total_amount: baseAmount,
    applied_balance_amount: 0,
    due_amount: baseAmount,
  }

  vi.mocked(useCustomerSubscriptionChargePreview).mockReturnValue({
    data: preview,
  } as unknown as ReturnType<typeof useCustomerSubscriptionChargePreview>)
}

describe('CurrentPeriodOverview', () => {
  beforeEach(() => {
    mockChargePreview(5000)
  })

  it('shows the locked amount instead of the current fixed catalog price', () => {
    mockChargePreview(2499)
    const subscription = createSubscription(createFixedPrice(2499), null, 2499)
    const { container } = render(
      <CurrentPeriodOverview
        subscription={subscription}
        products={[createProduct('product-1', createFixedPrice(1999))]}
        api={{} as Client}
      />,
    )

    expect(container.textContent).toContain(
      formatCurrency('compact')(2499, 'usd'),
    )
    expect(container.textContent).not.toContain(
      formatCurrency('compact')(1999, 'usd'),
    )
  })

  it('shows the locked amount instead of the custom catalog price label', () => {
    mockChargePreview(2499)
    const subscription = createSubscription(createCustomPrice(), null, 2499)
    const { container } = render(
      <CurrentPeriodOverview
        subscription={subscription}
        products={[createProduct('product-1', createCustomPrice())]}
        api={{} as Client}
      />,
    )

    expect(container.textContent).toContain(
      formatCurrency('compact')(2499, 'usd'),
    )
    expect(container.textContent).not.toContain('Pay what you want')
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

  it('shows the unit quantity with the merchant-defined label', () => {
    const price = createUnitPrice()
    const subscription = {
      ...createSubscription(price),
      seats: null,
      units: 3,
    } as schemas['CustomerSubscription']
    const { container } = render(
      <CurrentPeriodOverview
        subscription={subscription}
        products={[createProduct('product-1', price)]}
        api={{} as Client}
      />,
    )

    expect(container.textContent).toContain('Team plan (3 devices)')
  })
})
