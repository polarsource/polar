import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { type AcceptedLocale } from '@polar-sh/i18n'
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
    locale?: AcceptedLocale
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
      locale={overrides.locale ?? 'en'}
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

  describe('locale-aware thousands/decimal separator parsing', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it.each([
      ['5,000', 500000],
      ['1,234', 123400],
      ['12,345', 1234500],
      ['1,000,000', 100000000],
    ] as const)(
      'treats a comma as a thousands separator for en: %p -> %i cents',
      async (value, amount) => {
        const { update } = renderPWYW({ amount: 1500, minimumAmount: 500 })
        const input = screen.getByRole('textbox') as HTMLInputElement

        fireEvent.change(input, { target: { value } })

        await act(async () => {
          await vi.advanceTimersByTimeAsync(600)
        })

        expect(update).toHaveBeenCalledWith({ amount })
      },
    )

    it('preserves a period decimal together with thousands separators for en', async () => {
      const { update } = renderPWYW({ amount: 1500, minimumAmount: 500 })
      const input = screen.getByRole('textbox') as HTMLInputElement

      fireEvent.change(input, { target: { value: '5,000.99' } })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(600)
      })

      expect(update).toHaveBeenCalledWith({ amount: 500099 })
    })

    it('still rounds a period decimal correctly for en', async () => {
      const { update } = renderPWYW({ amount: 1500, minimumAmount: 500 })
      const input = screen.getByRole('textbox') as HTMLInputElement

      fireEvent.change(input, { target: { value: '5.55' } })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(600)
      })

      expect(update).toHaveBeenCalledWith({ amount: 555 })
    })

    it.each([
      ['12,5', 1250],
      ['12,50', 1250],
      ['12,500', 1250],
      ['1.234,56', 123456],
    ] as const)(
      'treats a comma as the decimal separator for de: %p -> %i cents',
      async (value, amount) => {
        const { update } = renderPWYW({
          amount: 1500,
          minimumAmount: 500,
          currency: 'eur',
          locale: 'de',
        })
        const input = screen.getByRole('textbox') as HTMLInputElement

        fireEvent.change(input, { target: { value } })

        await act(async () => {
          await vi.advanceTimersByTimeAsync(600)
        })

        expect(update).toHaveBeenCalledWith({ amount })
      },
    )

    it('does not collapse a US thousands-separated amount below the minimum', async () => {
      // Regression for the reported bug: "1,234" used to be parsed as 123 cents
      // (123400 intended), which fell below the $5 minimum and surfaced a
      // misleading "below minimum" error instead of the parser bug.
      const { update } = renderPWYW({ amount: 1500, minimumAmount: 500 })
      const input = screen.getByRole('textbox') as HTMLInputElement

      fireEvent.change(input, { target: { value: '1,234' } })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(600)
      })

      expect(update).toHaveBeenCalledWith({ amount: 123400 })
      expect(
        screen.queryByText(/Amount must be at least/i),
      ).not.toBeInTheDocument()
    })
  })
})
