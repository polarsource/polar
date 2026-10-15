import { useCustomerSubscriptionChargePreview } from '@/hooks/queries/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatChargeDate } from '@/utils/subscriptionCharge'
import { CurrentPeriodOverview } from './CurrentPeriodOverview'

vi.mock('@/hooks/queries/customerPortal', () => ({
  useCustomerSubscriptionChargePreview: vi.fn(),
}))

const createSeatPrice = (amount: number): schemas['ProductPriceSeatBased'] =>
  ({
    amount_type: 'seat_based',
    price_currency: 'usd',
    tiers: {
      type: 'volume',
      tiers: [{ bound: null, unit_amount: String(amount) }],
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

const mockChargePreview = (baseAmount: number, appliedBalanceAmount = 0) => {
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
    applied_balance_amount: appliedBalanceAmount,
    due_amount: baseAmount + appliedBalanceAmount,
    meter_charge: null,
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

  it('subtracts available customer credit from the amount due', () => {
    mockChargePreview(1000, -500)
    const subscription = createSubscription(createFixedPrice(1000), null, 1000)
    const { container } = render(
      <CurrentPeriodOverview
        subscription={subscription}
        products={[createProduct('product-1', createFixedPrice(1000))]}
        api={{} as Client}
      />,
    )

    const text = container.textContent ?? ''
    expect(text).toMatch(/Applied balance\s*-\$5/)
    expect(text).toMatch(/To be paid\s*\$5(?!\d)/)
  })

  it('hides the balance rows when no credit applies', () => {
    const subscription = createSubscription(createFixedPrice(5000), null, 5000)
    const { container } = render(
      <CurrentPeriodOverview
        subscription={subscription}
        products={[createProduct('product-1', createFixedPrice(5000))]}
        api={{} as Client}
      />,
    )

    expect(container.textContent).not.toContain('Applied balance')
    expect(container.textContent).not.toContain('To be paid')
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

  it('bills meter usage on the meter period, separate from the yearly renewal', () => {
    const periodEnd = '2027-01-01T00:00:00Z'
    const meterEnd = '2026-11-01T00:00:00Z'
    vi.mocked(useCustomerSubscriptionChargePreview).mockReturnValue({
      data: {
        base_amount: 12000,
        metered_amount: 0,
        proration_amount: 0,
        prorations: [],
        subtotal_amount: 12000,
        discount_amount: 2000,
        net_amount: 10000,
        tax_amount: 0,
        total_amount: 10000,
        applied_balance_amount: 0,
        due_amount: 10000,
        meter_charge: {
          metered_amount: 1840,
          subtotal_amount: 1840,
          discount_amount: 0,
          net_amount: 1840,
          tax_amount: 0,
          total_amount: 1840,
        },
      },
    } as unknown as ReturnType<typeof useCustomerSubscriptionChargePreview>)

    const subscription = {
      ...createSubscription(createFixedPrice(12000), null, 12000),
      recurring_interval: 'year',
      current_period_end: periodEnd,
      current_meter_period_end: meterEnd,
      meters: [
        {
          id: 'meter-1',
          amount: 1840,
          meter: { id: 'meter', name: 'API requests' },
        },
      ],
    } as unknown as schemas['CustomerSubscription']

    const { container } = render(
      <CurrentPeriodOverview
        subscription={subscription}
        products={[createProduct('product-1', createFixedPrice(12000))]}
        api={{} as Client}
      />,
    )

    const text = container.textContent ?? ''
    expect(text).toContain(`Next Invoice — ${formatChargeDate(periodEnd)}`)
    expect(text).toContain(`Next Invoice — ${formatChargeDate(meterEnd)}`)
    expect(text).toContain('Next Renewal')
    expect(text).toContain('Next Usage Charge')
    expect(text).toContain('API requests')
    expect(text).toContain(formatCurrency('compact')(10000, 'usd'))
    expect(text).toContain(formatCurrency('compact')(1840, 'usd'))
    expect(text).toMatch(/Discount\s*-\$20/)
    const usageAt = text.indexOf('Next Usage Charge')
    const discountAt = text.indexOf('Discount')
    expect(discountAt).toBeGreaterThan(-1)
    expect(discountAt).toBeLessThan(usageAt)
  })

  it('hides the usage card when the meter cycle has no overage', () => {
    vi.mocked(useCustomerSubscriptionChargePreview).mockReturnValue({
      data: {
        base_amount: 12000,
        metered_amount: 0,
        proration_amount: 0,
        prorations: [],
        subtotal_amount: 12000,
        discount_amount: 0,
        net_amount: 12000,
        tax_amount: 0,
        total_amount: 12000,
        applied_balance_amount: 0,
        due_amount: 12000,
        meter_charge: {
          metered_amount: 0,
          subtotal_amount: 0,
          discount_amount: 0,
          net_amount: 0,
          tax_amount: 0,
          total_amount: 0,
        },
      },
    } as unknown as ReturnType<typeof useCustomerSubscriptionChargePreview>)

    const subscription = {
      ...createSubscription(createFixedPrice(12000), null, 12000),
      recurring_interval: 'year',
      current_period_end: '2027-01-01T00:00:00Z',
      current_meter_period_end: '2026-11-01T00:00:00Z',
      meters: [
        {
          id: 'meter-1',
          amount: 0,
          meter: { id: 'meter', name: 'API requests' },
        },
      ],
    } as unknown as schemas['CustomerSubscription']

    const { container } = render(
      <CurrentPeriodOverview
        subscription={subscription}
        products={[createProduct('product-1', createFixedPrice(12000))]}
        api={{} as Client}
      />,
    )

    const text = container.textContent ?? ''
    expect(text).toContain('Next Renewal')
    expect(text).not.toContain('Next Usage Charge')
    expect(text).not.toContain('API requests')
  })
})
