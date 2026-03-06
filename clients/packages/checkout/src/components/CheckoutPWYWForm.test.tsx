import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  createBaseCheckout,
  createCustomPrice,
} from '../test-utils/makeCheckout'
import { CheckoutPWYWForm } from './CheckoutPWYWForm'

function renderPWYW(
  overrides: {
    amount?: number
    minimumAmount?: number
    currency?: string
  } = {},
) {
  const update = vi.fn()
  const productPrice = createCustomPrice({
    minimumAmount: overrides.minimumAmount ?? 500,
  })
  const checkout = createBaseCheckout({
    amount: overrides.amount ?? 1500,
    currency: overrides.currency ?? 'usd',
  })

  const result = render(
    <CheckoutPWYWForm
      update={update}
      checkout={checkout}
      productPrice={productPrice}
      locale="en"
    />,
  )

  return { update, result }
}

describe('CheckoutPWYWForm', () => {
  it('renders the label "Name a fair price"', () => {
    renderPWYW()

    expect(screen.getByText('Name a fair price')).toBeInTheDocument()
  })

  it('shows minimum amount when minimumAmount > 0', () => {
    renderPWYW({ minimumAmount: 500 })

    expect(screen.getByText(/\$5 minimum/)).toBeInTheDocument()
  })

  it('shows minimum amount for larger minimums', () => {
    renderPWYW({ minimumAmount: 2000 })

    expect(screen.getByText(/\$20 minimum/)).toBeInTheDocument()
  })

  it('does not show minimum label when minimumAmount is 0', () => {
    renderPWYW({ minimumAmount: 0 })

    expect(screen.queryByText(/minimum/)).not.toBeInTheDocument()
  })

  it('renders the money input', () => {
    renderPWYW()

    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
})
