import { Client, schemas } from '@polar-sh/client'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TrialEndedSubscriptionActions } from './TrialSubscriptionActions'

const push = vi.fn()
const mutateAsync = vi.fn()

vi.mock('@/hooks/queries/customerPortal', () => ({
  useCustomerCancelSubscription: vi.fn(),
  useCustomerPortalCustomer: vi.fn(),
  useCustomerReactivationOrder: () => ({
    mutateAsync,
    isPending: false,
    isSuccess: false,
  }),
}))

vi.mock('@/components/Toast/use-toast', () => ({ toast: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams('customer_session_token=token'),
}))

const subscription = {
  id: 'subscription-1',
  status: 'trial_ended',
  product: { organization: { slug: 'acme' } },
} as unknown as schemas['CustomerSubscription']

describe('TrialEndedSubscriptionActions', () => {
  beforeEach(() => {
    push.mockReset()
    mutateAsync.mockReset()
  })

  it('prepares the reactivation order and opens its pay page', async () => {
    mutateAsync.mockResolvedValue({ id: 'order-1' })
    render(
      <TrialEndedSubscriptionActions
        api={{} as Client}
        subscription={subscription}
      />,
    )

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        '/acme/portal/orders/order-1/pay?customer_session_token=token',
      ),
    )
    expect(mutateAsync).toHaveBeenCalledWith('subscription-1')
  })

  it('stays on the page when the order cannot be prepared', async () => {
    mutateAsync.mockRejectedValue(new Error('boom'))
    render(
      <TrialEndedSubscriptionActions
        api={{} as Client}
        subscription={subscription}
      />,
    )

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    expect(push).not.toHaveBeenCalled()
  })
})
