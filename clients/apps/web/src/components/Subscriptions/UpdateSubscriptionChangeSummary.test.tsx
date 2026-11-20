import { schemas } from '@polar-sh/client'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UpdateSubscriptionChangeSummary } from './UpdateSubscriptionChangeSummary'

vi.mock('@/hooks/queries', () => ({
  useDiscount: () => ({ data: undefined }),
}))

vi.mock('@/hooks/queries/subscriptions', () => ({
  useSubscriptionChangePreview: () => ({
    data: {
      proration_behavior: 'prorate',
      total_amount: 9000,
      due_amount: 9000,
      prorations: [],
    },
    isError: false,
  }),
}))

const subscription = {
  id: 'subscription-1',
  status: 'active',
  currency: 'usd',
  discount_id: null,
  recurring_interval: 'month',
  recurring_interval_count: 1,
  current_period_end: '2026-12-01T00:00:00Z',
  trial_end: null,
  product: { name: 'Monthly', organization_id: 'org-1' },
} as unknown as schemas['Subscription']

const renderSummary = (product: Partial<schemas['Product']>) =>
  render(
    <UpdateSubscriptionChangeSummary
      subscription={subscription}
      selectedProduct={
        { name: 'Other', ...product } as unknown as schemas['Product']
      }
      change={{ product_id: 'product-2', proration_behavior: 'prorate' }}
      isChangingDiscount={false}
      newDiscountId={null}
      trialOutcome={null}
    />,
  )

describe('UpdateSubscriptionChangeSummary', () => {
  it('defers a same-interval prorate change to the next invoice', () => {
    renderSummary({ recurring_interval: 'month', recurring_interval_count: 1 })
    expect(screen.getByText(/added on the/)).toBeTruthy()
  })

  it('charges today when a prorate change switches the billing interval', () => {
    renderSummary({ recurring_interval: 'year', recurring_interval_count: 1 })
    expect(screen.getByText('charged today')).toBeTruthy()
    expect(screen.queryByText(/on the .* invoice/)).toBeNull()
  })

  it('charges today when a prorate change switches the interval count', () => {
    renderSummary({ recurring_interval: 'month', recurring_interval_count: 3 })
    expect(screen.getByText('charged today')).toBeTruthy()
  })
})
