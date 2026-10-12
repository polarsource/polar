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
    totalAmount,
  }: {
    appliedBalanceAmount?: number | null
    dueAmount?: number | null
    totalAmount: number
  }) => (
    <div>
      <span>Total {totalAmount}</span>
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

const preview = (
  appliedBalanceAmount: number,
): schemas['SubscriptionChargePreview'] => ({
  base_amount: 1000,
  metered_amount: 0,
  proration_amount: 0,
  prorations: [],
  subtotal_amount: 1000,
  discount_amount: 0,
  net_amount: 1000,
  tax_amount: 0,
  total_amount: 1000,
  applied_balance_amount: appliedBalanceAmount,
  due_amount: 1000 + appliedBalanceAmount,
})

describe('SubscriptionInvoicePreview', () => {
  beforeEach(() => {
    vi.mocked(useSubscriptionChargePreview).mockReturnValue({
      data: preview(-500),
    } as unknown as ReturnType<typeof useSubscriptionChargePreview>)
  })

  it('passes the customer credit through to the invoice preview', () => {
    const { container } = render(
      <SubscriptionInvoicePreview subscription={subscription} />,
    )

    expect(container.textContent).toContain('Upcoming charge')
    expect(container.textContent).toContain('Applied balance -500')
    expect(container.textContent).toContain('To be paid 500')
  })
})
