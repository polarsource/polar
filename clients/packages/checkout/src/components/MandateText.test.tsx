import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MandateText } from './MandateText'

describe('MandateText', () => {
  it('renders one-time mandate with buyer terms link', () => {
    render(
      <MandateText
        isPaymentRequired={true}
        isTrial={false}
        isRecurring={false}
        buttonLabel="Pay now"
      />,
    )

    expect(screen.getByText(/Pay now/)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Buyer Terms' })
    expect(link).toHaveAttribute('href', 'https://polar.sh/legal/terms')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('renders subscription mandate with buyer terms link', () => {
    render(
      <MandateText
        isPaymentRequired={true}
        isTrial={false}
        isRecurring={true}
        buttonLabel="Subscribe"
      />,
    )

    expect(screen.getByText(/Subscribe/)).toBeInTheDocument()
    expect(screen.getByText(/until you cancel/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Buyer Terms' }),
    ).toBeInTheDocument()
  })

  it('renders trial mandate with buyer terms link', () => {
    render(
      <MandateText
        isPaymentRequired={true}
        isTrial={true}
        isRecurring={false}
        buttonLabel="Start trial"
      />,
    )

    expect(screen.getByText(/Start trial/)).toBeInTheDocument()
    expect(screen.getByText(/trial period/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Buyer Terms' }),
    ).toBeInTheDocument()
  })

  it('renders merchant of record text without buyer terms link when payment is not required', () => {
    render(
      <MandateText
        isPaymentRequired={false}
        isTrial={false}
        isRecurring={false}
        buttonLabel="Continue"
      />,
    )

    expect(screen.getByText(/Merchant of Record/)).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Buyer Terms' }),
    ).not.toBeInTheDocument()
  })
})
