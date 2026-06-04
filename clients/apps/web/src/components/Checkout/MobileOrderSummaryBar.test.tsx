import { createCheckout } from '@polar-sh/checkout/test-utils'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MobileOrderSummaryBar } from './MobileOrderSummaryBar'

afterEach(cleanup)

const nonTrialCheckout = createCheckout({
  amount: 1999,
  net_amount: 1999,
  total_amount: 1999,
})

const baseProduct = createCheckout().product
const trialCheckout = createCheckout({
  amount: 9999,
  net_amount: 9999,
  total_amount: 9999,
  active_trial_interval: 'month',
  active_trial_interval_count: 1,
  trial_end: '2026-04-05T00:00:00Z',
  product: {
    ...baseProduct,
    recurring_interval: 'year',
    is_recurring: true,
    trial_interval: 'month',
    trial_interval_count: 1,
  },
})

describe('MobileOrderSummaryBar', () => {
  it('renders an "Order summary" button', () => {
    render(
      <MobileOrderSummaryBar
        checkout={nonTrialCheckout}
        locale="en"
        hasTrial={false}
        isOpen={false}
        onToggle={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /order summary/i })).toBeDefined()
  })

  it('renders the formatted total when hasTrial is false', () => {
    render(
      <MobileOrderSummaryBar
        checkout={nonTrialCheckout}
        locale="en"
        hasTrial={false}
        isOpen={false}
        onToggle={() => {}}
      />,
    )
    expect(screen.getByText('$19.99')).toBeDefined()
  })

  it('renders the compact trial copy when hasTrial is true', () => {
    render(
      <MobileOrderSummaryBar
        checkout={trialCheckout}
        locale="en"
        hasTrial={true}
        isOpen={false}
        onToggle={() => {}}
      />,
    )

    expect(screen.getByText('1 month free')).toBeDefined()
    const button = screen.getByRole('button')
    expect(button.textContent).toContain('$99.99/yr')
    expect(button.textContent).not.toContain('starting')
    expect(button.textContent).not.toContain('April')
  })

  it('does NOT render the plain non-trial total when hasTrial is true', () => {
    render(
      <MobileOrderSummaryBar
        checkout={trialCheckout}
        locale="en"
        hasTrial={true}
        isOpen={false}
        onToggle={() => {}}
      />,
    )

    expect(screen.queryByText('$99.99 / year')).toBeNull()
  })

  it('aria-expanded reflects isOpen', () => {
    const props = {
      checkout: nonTrialCheckout,
      locale: 'en' as const,
      hasTrial: false,
      onToggle: () => {},
    }
    const { rerender } = render(
      <MobileOrderSummaryBar {...props} isOpen={false} />,
    )
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe(
      'false',
    )

    rerender(<MobileOrderSummaryBar {...props} isOpen={true} />)
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe(
      'true',
    )
  })

  it('calls onToggle when the bar is clicked', () => {
    const onToggle = vi.fn()
    render(
      <MobileOrderSummaryBar
        checkout={nonTrialCheckout}
        locale="en"
        hasTrial={false}
        isOpen={false}
        onToggle={onToggle}
      />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
