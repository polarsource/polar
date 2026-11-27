import { schemas } from '@polar-sh/client'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TrialEndedSubscriptionActions } from './TrialSubscriptionActions'

vi.mock('@/hooks/queries/customerPortal', () => ({
  useCustomerCancelSubscription: vi.fn(),
  useCustomerPortalCustomer: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('customer_session_token=token'),
}))

const subscription = {
  id: 'subscription-1',
  status: 'trial_ended',
  product: { organization: { slug: 'acme' } },
} as unknown as schemas['CustomerSubscription']

describe('TrialEndedSubscriptionActions', () => {
  it('links to the reactivation page', () => {
    render(<TrialEndedSubscriptionActions subscription={subscription} />)

    expect(
      screen.getByRole('link', { name: 'Reactivate subscription' }),
    ).toHaveAttribute(
      'href',
      '/acme/portal/subscriptions/subscription-1/reactivate?customer_session_token=token',
    )
  })
})
