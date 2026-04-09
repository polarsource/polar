import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  createCheckout,
  createSeatBasedPrice,
} from '@polar-sh/checkout/test-utils'
import CheckoutSeatInvitations from './CheckoutSeatInvitations'

vi.mock('@/hooks/queries', () => ({
  useAssignSeatFromCheckout: () => ({ mutateAsync: vi.fn() }),
}))

describe('CheckoutSeatInvitations', () => {
  it('returns null for non-seat-based products', () => {
    const checkout = createCheckout()
    const { container } = render(
      <CheckoutSeatInvitations checkout={checkout} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('returns null when seats is not set', () => {
    const checkout = createCheckout({
      product_price: createSeatBasedPrice(),
      seats: undefined,
    })
    const { container } = render(
      <CheckoutSeatInvitations checkout={checkout} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders invite form for seat-based products', () => {
    const checkout = createCheckout({
      product_price: createSeatBasedPrice(),
      seats: 3,
    })
    render(<CheckoutSeatInvitations checkout={checkout} />)
    expect(screen.getByText('Invite team members')).toBeInTheDocument()
    expect(screen.getByText(/3 seats available/)).toBeInTheDocument()
  })

  it('pre-fills customer email when available', () => {
    const checkout = createCheckout({
      product_price: createSeatBasedPrice(),
      seats: 3,
      customer_email: 'user@example.com',
    })
    render(<CheckoutSeatInvitations checkout={checkout} />)
    const inputs = screen.getAllByRole('textbox')
    expect(inputs[0]).toHaveValue('user@example.com')
  })
})
