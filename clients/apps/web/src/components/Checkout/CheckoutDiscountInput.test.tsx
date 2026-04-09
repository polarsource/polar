import { fireEvent, render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'
import type { schemas } from '@polar-sh/client'
import { createCheckout } from '@polar-sh/checkout/test-utils'
import { CheckoutDiscountInput } from './CheckoutDiscountInput'

let formRef: ReturnType<typeof useForm<schemas['CheckoutUpdatePublic']>>

vi.mock('@polar-sh/checkout/providers', () => ({
  useCheckoutForm: () => ({ form: formRef }),
}))

function renderDiscountInput(
  overrides: Partial<Parameters<typeof CheckoutDiscountInput>[0]> = {},
) {
  const defaults = {
    checkout: createCheckout({
      allow_discount_codes: true,
      is_discount_applicable: true,
    }),
    update: vi.fn(),
    locale: 'en' as const,
    ...overrides,
  }

  function Wrapper() {
    const form = useForm<schemas['CheckoutUpdatePublic']>({
      defaultValues: { customer_email: '', discount_code: undefined },
    })
    formRef = form
    return <CheckoutDiscountInput {...defaults} />
  }

  return render(<Wrapper />)
}

describe('CheckoutDiscountInput', () => {
  it('returns null when discount codes are not allowed', () => {
    const { container } = renderDiscountInput({
      checkout: createCheckout({ allow_discount_codes: false }),
    })
    expect(container.innerHTML).toBe('')
  })

  it('returns null when discount is not applicable', () => {
    const { container } = renderDiscountInput({
      checkout: createCheckout({ is_discount_applicable: false }),
    })
    expect(container.innerHTML).toBe('')
  })

  it('renders discount code input when allowed', () => {
    renderDiscountInput()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('shows collapsed button in collapsible mode', () => {
    renderDiscountInput({ collapsible: true })
    expect(
      screen.getByRole('button', { name: /discount/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('expands discount input when button is clicked in collapsible mode', () => {
    renderDiscountInput({ collapsible: true })
    fireEvent.click(screen.getByRole('button', { name: /discount/i }))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('disables input when discount already applied', () => {
    renderDiscountInput({
      checkout: createCheckout({
        allow_discount_codes: true,
        is_discount_applicable: true,
        discount: {
          id: 'disc_1',
          name: '10% off',
          code: 'SAVE10',
          type: 'percentage',
          basis_points: 1000,
          amount: null,
          currency: null,
        },
      }),
    })
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})
