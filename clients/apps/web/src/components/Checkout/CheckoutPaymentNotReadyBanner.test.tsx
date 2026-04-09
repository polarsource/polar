import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CheckoutPaymentNotReadyBanner } from './CheckoutPaymentNotReadyBanner'

describe('CheckoutPaymentNotReadyBanner', () => {
  it('shows denied messaging when organization status is denied', () => {
    render(
      <CheckoutPaymentNotReadyBanner
        organizationStatus="denied"
        organizationName="Acme Inc"
      />,
    )

    expect(
      screen.getByText('Payments are currently unavailable'),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Acme Inc doesn't allow payments."),
    ).toBeInTheDocument()
  })

  it('shows test mode messaging when organization status is not denied', () => {
    render(
      <CheckoutPaymentNotReadyBanner
        organizationStatus="under_review"
        organizationName="Acme Inc"
      />,
    )

    expect(screen.getByText('Acme Inc is in test mode')).toBeInTheDocument()
    expect(
      screen.getByText(
        'You can test checkout with free products or 100% discount orders.',
      ),
    ).toBeInTheDocument()
  })

  it('shows test mode messaging when organization status is undefined', () => {
    render(
      <CheckoutPaymentNotReadyBanner
        organizationStatus={undefined}
        organizationName="Acme Inc"
      />,
    )

    expect(screen.getByText('Acme Inc is in test mode')).toBeInTheDocument()
  })
})
