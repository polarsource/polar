import { useSubscriptionChargePreview } from '@/hooks/queries/subscriptions'
import { schemas } from '@polar-sh/client'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SubscriptionInvoicePreview from './SubscriptionInvoicePreview'

vi.mock('@/hooks/queries', () => ({
  useProduct: () => ({
    data: {
      name: 'Starter',
      prices: [
        {
          amount_type: 'fixed',
          price_currency: 'usd',
          price_amount: 1000,
        },
      ],
    },
  }),
}))

vi.mock('@/hooks/queries/subscriptions', () => ({
  useSubscriptionChargePreview: vi.fn(),
}))

vi.mock('@/components/Orders/InvoicePreview', () => ({
  InvoicePreview: ({
    appliedBalanceAmount,
    dueAmount,
  }: {
    appliedBalanceAmount?: number | null
    dueAmount?: number | null
  }) => (
    <div>
      <span>Applied balance {appliedBalanceAmount}</span>
      <span>To be paid {dueAmount}</span>
    </div>
  ),
}))

const subscription = {
  id: 'subscription-1',
  status: 'active',
  cancel_at_period_end: false,
  ended_at: null,
  pause_at_period_end: false,
  resumes_at: null,
  pending_update: null,
  product_id: 'product-1',
  seats: null,
  prices: [{ amount_type: 'fixed', price_amount: 1000, price_currency: 'usd' }],
  meters: [],
  currency: 'usd',
  product: { name: 'Starter' },
  current_period_end: '2026-10-27T00:00:00Z',
} as unknown as schemas['Subscription']

const chargePreview: schemas['SubscriptionChargePreview'] = {
  base_amount: 1000,
  metered_amount: 0,
  proration_amount: 0,
  prorations: [],
  subtotal_amount: 1000,
  discount_amount: 0,
  net_amount: 1000,
  tax_amount: 0,
  total_amount: 1000,
  applied_balance_amount: -500,
  due_amount: 500,
  meter_charge: null,
}

describe('SubscriptionInvoicePreview', () => {
  beforeEach(() => {
    vi.mocked(useSubscriptionChargePreview).mockReturnValue({
      data: chargePreview,
    } as unknown as ReturnType<typeof useSubscriptionChargePreview>)
  })

  it('passes the customer credit through to the invoice preview', () => {
    const { container } = render(
      <SubscriptionInvoicePreview subscription={subscription} />,
    )

    expect(container.textContent).toContain('Upcoming renewal')
    expect(container.textContent).toContain('Applied balance -500')
    expect(container.textContent).toContain('To be paid 500')
  })

  it('lists the usage charge before the renewal', () => {
    vi.mocked(useSubscriptionChargePreview).mockReturnValue({
      data: {
        ...chargePreview,
        meter_charge: {
          metered_amount: 1840,
          subtotal_amount: 1840,
          discount_amount: 0,
          net_amount: 1840,
          tax_amount: 0,
          total_amount: 1840,
        },
      },
    } as unknown as ReturnType<typeof useSubscriptionChargePreview>)

    const { container } = render(
      <SubscriptionInvoicePreview
        subscription={
          {
            ...subscription,
            current_meter_period_end: '2026-11-01T00:00:00Z',
            meters: [
              {
                id: 'meter-1',
                amount: 1840,
                meter: { id: 'meter', name: 'API requests' },
              },
            ],
          } as unknown as schemas['Subscription']
        }
      />,
    )

    const text = container.textContent ?? ''
    const usageAt = text.indexOf('Upcoming usage charge')
    const renewalAt = text.indexOf('Upcoming renewal')
    expect(usageAt).toBeGreaterThan(-1)
    expect(renewalAt).toBeGreaterThan(usageAt)
  })

  it('drops the final charge when a canceled subscription only has separate usage', () => {
    vi.mocked(useSubscriptionChargePreview).mockReturnValue({
      data: {
        ...chargePreview,
        base_amount: 0,
        subtotal_amount: 0,
        net_amount: 0,
        total_amount: 0,
        applied_balance_amount: 0,
        due_amount: 0,
        meter_charge: {
          metered_amount: 1840,
          subtotal_amount: 1840,
          discount_amount: 0,
          net_amount: 1840,
          tax_amount: 0,
          total_amount: 1840,
        },
      },
    } as unknown as ReturnType<typeof useSubscriptionChargePreview>)

    const { container } = render(
      <SubscriptionInvoicePreview
        subscription={
          {
            ...subscription,
            cancel_at_period_end: true,
            current_meter_period_end: '2026-11-01T00:00:00Z',
            meters: [
              {
                id: 'meter-1',
                amount: 1840,
                meter: { id: 'meter', name: 'API requests' },
              },
            ],
          } as unknown as schemas['Subscription']
        }
      />,
    )

    const text = container.textContent ?? ''
    expect(text).toContain('Upcoming usage charge')
    expect(text).not.toContain('Final charge')
  })
})
