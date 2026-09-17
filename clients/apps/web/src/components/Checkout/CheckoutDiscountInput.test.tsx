import { screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  applyDiscountCode,
  getDiscountCodeButton,
  percentageDiscount,
  renderCheckout,
} from '@/test-utils/checkout'

const HALF_OFF = percentageDiscount('HALF50', 5000)

describe('discount codes', () => {
  it('applies a valid code and shows the discounted price', async () => {
    const { api } = renderCheckout({ discounts: { HALF50: HALF_OFF } })

    applyDiscountCode('HALF50')

    await waitFor(() => expect(api.checkout.discount?.code).toBe('HALF50'))
    expect(api.requests).toContainEqual(
      expect.objectContaining({
        method: 'PATCH',
        body: { discount_code: 'HALF50' },
      }),
    )
    expect((await screen.findAllByText('$4.99')).length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('HALF50')).toBeDisabled()
  })

  it('removes an applied code and restores the full price', async () => {
    const { api } = renderCheckout({
      checkout: {
        discount: HALF_OFF,
        discount_amount: 500,
        net_amount: 499,
        total_amount: 499,
      },
      discounts: { HALF50: HALF_OFF },
    })
    fireEvent.click(getDiscountCodeButton())

    await waitFor(() => expect(api.checkout.discount).toBeNull())
    expect(api.requests).toContainEqual(
      expect.objectContaining({
        method: 'PATCH',
        body: { discount_code: null },
      }),
    )
    expect((await screen.findAllByText('$9.99')).length).toBeGreaterThan(0)
  })

  it('shows the validation message for an unknown code', async () => {
    renderCheckout()

    applyDiscountCode('NOPE')

    expect(
      await screen.findByText('Discount code is invalid'),
    ).toBeInTheDocument()
    expect(screen.queryByText('$4.99')).not.toBeInTheDocument()
  })

  it('is not offered when the checkout does not accept codes', () => {
    renderCheckout({ checkout: { allow_discount_codes: false } })

    expect(
      screen.queryByRole('button', { name: 'Add discount code' }),
    ).not.toBeInTheDocument()
  })
})
