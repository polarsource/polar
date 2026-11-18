import {
  useCustomerPortalCustomer,
  useCustomerReactivateSubscription,
} from '@/hooks/queries/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TrialEndedSubscriptionActions } from './TrialSubscriptionActions'

vi.mock('@/hooks/queries/customerPortal', () => ({
  useCustomerCancelSubscription: vi.fn(),
  useCustomerPortalCustomer: vi.fn(),
  useCustomerReactivateSubscription: vi.fn(),
}))

vi.mock('@/app/actions', () => ({ default: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams('customer_session_token=token'),
}))

const subscription = {
  id: 'subscription-1',
  status: 'trial_ended',
  product: { organization: { slug: 'acme' } },
} as unknown as schemas['CustomerSubscription']

const mockCustomer = (customer: Partial<schemas['CustomerPortalCustomer']>) =>
  vi.mocked(useCustomerPortalCustomer).mockReturnValue({
    data: customer,
  } as unknown as ReturnType<typeof useCustomerPortalCustomer>)

const mutateAsync = vi.fn()

const renderActions = () =>
  render(
    <TrialEndedSubscriptionActions
      api={{} as Client}
      subscription={subscription}
    />,
  )

describe('TrialEndedSubscriptionActions', () => {
  beforeEach(() => {
    mutateAsync.mockReset()
    vi.mocked(useCustomerReactivateSubscription).mockReturnValue({
      mutateAsync,
    } as unknown as ReturnType<typeof useCustomerReactivateSubscription>)
  })

  it('links to billing details when they are missing', () => {
    mockCustomer({ default_payment_method_id: null, billing_address: null })

    renderActions()

    expect(
      screen.getByRole('link', { name: 'Add billing details' }),
    ).toHaveAttribute(
      'href',
      '/acme/portal/settings?customer_session_token=token',
    )
    expect(
      screen.queryByRole('button', { name: 'Reactivate subscription' }),
    ).toBeNull()
  })

  it('reactivates after confirmation', async () => {
    mockCustomer({
      default_payment_method_id: 'payment-method-1',
      billing_address: {
        country: 'FR',
      } as schemas['CustomerPortalCustomer']['billing_address'],
    })

    renderActions()
    fireEvent.click(
      screen.getByRole('button', { name: 'Reactivate subscription' }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Reactivate and pay' }),
    )

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ id: 'subscription-1' }),
    )
  })
})
