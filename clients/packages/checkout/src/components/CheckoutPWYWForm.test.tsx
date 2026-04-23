import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    minimum_amount: overrides.minimumAmount ?? 500,
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

  describe('amount validation & debounced update', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('calls update with the new amount after the debounce when valid', async () => {
      const { update } = renderPWYW({ amount: 1500, minimumAmount: 500 })
      const input = screen.getByRole('textbox') as HTMLInputElement

      fireEvent.change(input, { target: { value: '25' } })

      expect(update).not.toHaveBeenCalled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(600)
      })

      expect(update).toHaveBeenCalledWith({ amount: 2500 })
    })

    it('shows minimum-amount error and does not call update when below minimum', async () => {
      const { update } = renderPWYW({ amount: 1500, minimumAmount: 500 })
      const input = screen.getByRole('textbox') as HTMLInputElement

      fireEvent.change(input, { target: { value: '1' } })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(600)
      })

      await waitFor(() => {
        expect(screen.getByText(/minimum/i)).toBeInTheDocument()
      })
      expect(update).not.toHaveBeenCalled()
    })

    it('shows the "free or minimum" error for amounts between 0 and 50 when min is 0', async () => {
      const { update } = renderPWYW({ amount: 0, minimumAmount: 0 })
      const input = screen.getByRole('textbox') as HTMLInputElement

      fireEvent.change(input, { target: { value: '0.25' } })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(600)
      })

      await waitFor(() => {
        expect(screen.getByText(/\$0 or at least \$0\.50/i)).toBeInTheDocument()
      })
      expect(update).not.toHaveBeenCalled()
    })

    it('does not call update when the typed amount equals the current checkout amount', async () => {
      const { update } = renderPWYW({ amount: 2500, minimumAmount: 500 })
      const input = screen.getByRole('textbox') as HTMLInputElement

      fireEvent.change(input, { target: { value: '25' } })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(600)
      })

      expect(update).not.toHaveBeenCalled()
    })
  })
})
