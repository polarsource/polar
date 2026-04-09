import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  createCheckout,
  createSeatBasedPrice,
} from '@polar-sh/checkout/test-utils'
import { CheckoutConfirmation } from './CheckoutConfirmation'

// Module-level loadStripe call runs on import
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: () => Promise.resolve(null),
}))

// Stripe Elements used in confirmed status JSX
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ElementsConsumer: ({
    children,
  }: {
    children: (args: { stripe: null }) => React.ReactNode
  }) => <>{children({ stripe: null })}</>,
}))

// Hooks that run unconditionally during render
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/utils/api', () => ({
  getServerURL: () => 'https://api.example.com',
}))
vi.mock('@/hooks/checkout', () => ({
  useCheckoutConfirmedRedirect: () => vi.fn(),
}))
vi.mock('@/hooks/sse', () => ({
  useCheckoutClientSSE: () => ({ on: vi.fn(), off: vi.fn() }),
}))

// CheckoutSeatInvitations calls this hook unconditionally
vi.mock('@/hooks/queries', () => ({
  useAssignSeatFromCheckout: () => ({ mutateAsync: vi.fn() }),
}))

function renderConfirmation(
  overrides: Partial<Parameters<typeof CheckoutConfirmation>[0]> = {},
) {
  return render(
    <CheckoutConfirmation
      checkout={createCheckout()}
      embed={false}
      locale="en"
      disabled={true}
      {...overrides}
    />,
  )
}

describe('CheckoutConfirmation', () => {
  it('shows processing state for confirmed checkout', () => {
    renderConfirmation({ checkout: createCheckout({ status: 'confirmed' }) })
    expect(screen.getByText(/processing/i)).toBeInTheDocument()
  })

  it('shows success state for succeeded checkout', () => {
    // Use seat_based price so CheckoutBenefits (and its heavy deps) don't render
    renderConfirmation({
      checkout: createCheckout({
        status: 'succeeded',
        product_price: createSeatBasedPrice(),
      }),
    })
    expect(screen.getByText(/successful/i)).toBeInTheDocument()
  })

  it('shows failed state for failed checkout', () => {
    renderConfirmation({ checkout: createCheckout({ status: 'failed' }) })
    expect(screen.getByText(/problem occurred/i)).toBeInTheDocument()
  })
})
