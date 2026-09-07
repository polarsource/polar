import { createCheckout } from '@polar-sh/checkout/test-utils'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  createBenefitGrant,
  customBenefit,
  renderConfirmation,
} from '@/test-utils/checkout'

describe('CheckoutConfirmation', () => {
  it('thanks the customer once the checkout has succeeded', () => {
    renderConfirmation()

    expect(screen.getByText('Thank you for your order!')).toBeInTheDocument()
    expect(
      screen.getByText('You now have access to Test Product.'),
    ).toBeInTheDocument()
  })

  it('shows processing until the checkout succeeds, then the success state', async () => {
    const { api } = renderConfirmation({ checkout: { status: 'confirmed' } })

    expect(screen.getByText('We are processing your order')).toBeInTheDocument()

    api.set({ status: 'succeeded' })
    api.emitCheckoutEvent({
      key: 'checkout.updated',
      payload: { status: 'succeeded' },
    })

    expect(
      await screen.findByText('Thank you for your order!'),
    ).toBeInTheDocument()
  })

  it('sends the customer back to the checkout when it reopened', async () => {
    const { router, checkout } = renderConfirmation({
      checkout: { status: 'open' },
    })

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(checkout.url))
  })

  it('does not redirect when disabled', async () => {
    const { router } = renderConfirmation({
      checkout: { status: 'open' },
      disabled: true,
    })

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(router.push).not.toHaveBeenCalled()
  })

  it('explains a failed payment', () => {
    renderConfirmation({ checkout: { status: 'failed' } })

    expect(
      screen.getByText('A problem occurred while processing your order'),
    ).toBeInTheDocument()
  })

  it('lists benefits as they are granted', async () => {
    const { api } = renderConfirmation({
      checkout: {
        product: { ...createCheckout().product, benefits: [customBenefit] },
      },
    })

    expect(await screen.findByText('Granting benefits...')).toBeInTheDocument()

    api.grantBenefits([createBenefitGrant()])
    api.emitCustomerEvent({ key: 'benefit.granted', payload: {} })

    expect(await screen.findByText('Community access')).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByText('Granting benefits...'),
      ).not.toBeInTheDocument(),
    )
  })
})
