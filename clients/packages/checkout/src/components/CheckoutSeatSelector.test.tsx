import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ProductCheckoutPublic } from '../guards'
import {
  createCheckout,
  createFixedPrice,
  createSeatBasedPrice,
} from '../test-utils/makeCheckout'
import CheckoutSeatSelector from './CheckoutSeatSelector'

const seatDefaults: Partial<ProductCheckoutPublic> = {
  amount: 3147,
  net_amount: 3147,
  tax_amount: null,
  total_amount: 3147,
  seats: 3,
  min_seats: null,
  max_seats: null,
  product_price: createSeatBasedPrice({
    seat_tiers: {
      seat_tier_type: 'volume',
      tiers: [{ min_seats: 1, max_seats: null, price_per_seat: 1049 }],
      minimum_seats: 1,
      maximum_seats: null,
    },
  }),
}

function createSeatCheckout(
  overrides: Partial<ProductCheckoutPublic> = {},
): ProductCheckoutPublic {
  return createCheckout({ ...seatDefaults, ...overrides })
}

const noopUpdate = vi.fn().mockResolvedValue({} as ProductCheckoutPublic)

describe('CheckoutSeatSelector', () => {
  describe('default layout total amount display', () => {
    it('shows netAmount (current behavior, no tax)', () => {
      const checkout = createSeatCheckout({
        net_amount: 3147,
        total_amount: 3147,
        tax_amount: null,
      })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
        />,
      )

      expect(screen.getByTestId('headline-price')).toHaveTextContent('$31.47')
    })

    it('shows netAmount even when totalAmount differs (current behavior with tax)', () => {
      const checkout = createSeatCheckout({
        net_amount: 3147,
        tax_amount: 787,
        total_amount: 3934,
      })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
        />,
      )

      expect(screen.getByTestId('headline-price')).toHaveTextContent('$31.47')
    })
  })

  describe('returns null for non-seat-based pricing', () => {
    it('renders nothing for fixed price', () => {
      const checkout = createCheckout({
        product_price: createFixedPrice(),
      })

      const { container } = render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
        />,
      )

      expect(container.innerHTML).toBe('')
    })
  })

  describe('with discount', () => {
    it('shows discounted netAmount (current behavior)', () => {
      const checkout = createSeatCheckout({
        amount: 3147,
        discount_amount: 629,
        net_amount: 2518,
        tax_amount: null,
        total_amount: 2518,
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basis_points: 2000,
        } as ProductCheckoutPublic['discount'],
      })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
        />,
      )

      expect(screen.getByTestId('headline-price')).toHaveTextContent('$25.18')
    })

    it('shows netAmount not totalAmount when discount + tax (current behavior)', () => {
      const checkout = createSeatCheckout({
        amount: 3147,
        discount_amount: 629,
        net_amount: 2518,
        tax_amount: 630,
        total_amount: 3148,
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basis_points: 2000,
        } as ProductCheckoutPublic['discount'],
      })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
        />,
      )

      expect(screen.getByTestId('headline-price')).toHaveTextContent('$25.18')
    })
  })

  describe('compact layout', () => {
    it('shows "Seats" label', () => {
      const checkout = createSeatCheckout()

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
          compact
        />,
      )

      expect(screen.getByText('Seats')).toBeInTheDocument()
    })

    it('shows stepper buttons', () => {
      const checkout = createSeatCheckout()

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
          compact
        />,
      )

      expect(screen.getByLabelText('Decrease seats')).toBeInTheDocument()
      expect(screen.getByLabelText('Increase seats')).toBeInTheDocument()
    })

    it('calls update with seats+1 when increase is clicked in compact mode', async () => {
      const update = vi.fn().mockResolvedValue({} as ProductCheckoutPublic)
      const checkout = createSeatCheckout({ seats: 3 })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={update}
          locale="en"
          compact
        />,
      )

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Increase seats'))
      })

      expect(update).toHaveBeenCalledWith({ seats: 4 })
    })

    it('enters edit mode in compact layout when seat count is clicked', () => {
      const checkout = createSeatCheckout({ seats: 3 })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
          compact
        />,
      )

      fireEvent.click(screen.getByLabelText('Click to edit seat count'))

      expect(screen.getByDisplayValue('3')).toBeInTheDocument()
    })

    it('updates seats from compact edit input on blur', async () => {
      const update = vi.fn().mockResolvedValue({} as ProductCheckoutPublic)
      const checkout = createSeatCheckout({ seats: 3 })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={update}
          locale="en"
          compact
        />,
      )

      fireEvent.click(screen.getByLabelText('Click to edit seat count'))
      const input = screen.getByDisplayValue('3') as HTMLInputElement

      await act(async () => {
        fireEvent.change(input, { target: { value: '6' } })
        fireEvent.blur(input)
      })

      expect(update).toHaveBeenCalledWith({ seats: 6 })
    })

    it('renders the seat-limit text in compact mode when min/max are set', () => {
      const checkout = createSeatCheckout({
        seats: 5,
        min_seats: 3,
        max_seats: 10,
      })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
          compact
        />,
      )

      expect(screen.getByText('3 - 10 seats')).toBeInTheDocument()
    })
  })

  describe('fixed seats (min === max)', () => {
    it('shows just the seat count, no stepper buttons', () => {
      const checkout = createSeatCheckout({
        seats: 5,
        min_seats: 5,
        max_seats: 5,
      })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
        />,
      )

      expect(screen.queryByLabelText('Decrease seats')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Increase seats')).not.toBeInTheDocument()
    })

    it('shows just the count in compact mode too', () => {
      const checkout = createSeatCheckout({
        seats: 5,
        min_seats: 5,
        max_seats: 5,
      })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
          compact
        />,
      )

      expect(screen.queryByLabelText('Decrease seats')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Increase seats')).not.toBeInTheDocument()
    })
  })

  describe('seat limit text', () => {
    it('shows "Minimum X seats" when only min is set', () => {
      const checkout = createSeatCheckout({
        seats: 5,
        min_seats: 3,
        max_seats: null,
        product_price: createSeatBasedPrice({
          seat_tiers: {
            seat_tier_type: 'volume',
            tiers: [{ min_seats: 1, max_seats: null, price_per_seat: 1000 }],
            minimum_seats: 1,
            maximum_seats: null,
          },
        }),
      })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
        />,
      )

      expect(screen.getByText('Minimum 3 seats')).toBeInTheDocument()
    })

    it('shows "Maximum X seats" when only max is set', () => {
      const checkout = createSeatCheckout({
        seats: 3,
        min_seats: null,
        max_seats: 10,
        product_price: createSeatBasedPrice({
          seat_tiers: {
            seat_tier_type: 'volume',
            tiers: [{ min_seats: 1, max_seats: null, price_per_seat: 1000 }],
            minimum_seats: 1,
            maximum_seats: null,
          },
        }),
      })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
        />,
      )

      expect(screen.getByText('Maximum 10 seats')).toBeInTheDocument()
    })

    it('shows "X - Y seats" when both min and max are set', () => {
      const checkout = createSeatCheckout({
        seats: 5,
        min_seats: 3,
        max_seats: 10,
        product_price: createSeatBasedPrice({
          seat_tiers: {
            seat_tier_type: 'volume',
            tiers: [{ min_seats: 1, max_seats: null, price_per_seat: 1000 }],
            minimum_seats: 1,
            maximum_seats: null,
          },
        }),
      })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
        />,
      )

      expect(screen.getByText('3 - 10 seats')).toBeInTheDocument()
    })
  })

  describe('graduated pricing', () => {
    const graduatedDefaults: Partial<ProductCheckoutPublic> = {
      amount: 14000,
      net_amount: 14000,
      tax_amount: null,
      total_amount: 14000,
      seats: 15,
      min_seats: null,
      max_seats: null,
      product_price: createSeatBasedPrice({
        seat_tiers: {
          seat_tier_type: 'graduated',
          tiers: [
            { min_seats: 1, max_seats: 10, price_per_seat: 1000 },
            { min_seats: 11, max_seats: null, price_per_seat: 800 },
          ],
          minimum_seats: 1,
          maximum_seats: null,
        },
      }),
    }

    function createGraduatedCheckout(
      overrides: Partial<ProductCheckoutPublic> = {},
    ): ProductCheckoutPublic {
      return createCheckout({ ...graduatedDefaults, ...overrides })
    }

    it('shows total amount for graduated pricing', () => {
      const checkout = createGraduatedCheckout()

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
        />,
      )

      expect(screen.getByTestId('headline-price')).toHaveTextContent('$140')
    })

    it('renders stepper buttons for graduated pricing', () => {
      const checkout = createGraduatedCheckout()

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
        />,
      )

      expect(screen.getByLabelText('Decrease seats')).toBeInTheDocument()
      expect(screen.getByLabelText('Increase seats')).toBeInTheDocument()
    })
  })

  describe('stepper interactions', () => {
    it('calls update with seats+1 when increase is clicked', async () => {
      const update = vi.fn().mockResolvedValue({} as ProductCheckoutPublic)
      const checkout = createSeatCheckout({ seats: 3 })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={update}
          locale="en"
        />,
      )

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Increase seats'))
      })

      expect(update).toHaveBeenCalledWith({ seats: 4 })
    })

    it('calls update with seats-1 when decrease is clicked', async () => {
      const update = vi.fn().mockResolvedValue({} as ProductCheckoutPublic)
      const checkout = createSeatCheckout({ seats: 3 })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={update}
          locale="en"
        />,
      )

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Decrease seats'))
      })

      expect(update).toHaveBeenCalledWith({ seats: 2 })
    })

    it('does not call update when clicking decrease at the minimum', async () => {
      const update = vi.fn().mockResolvedValue({} as ProductCheckoutPublic)
      const checkout = createSeatCheckout({ seats: 1 })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={update}
          locale="en"
        />,
      )

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Decrease seats'))
      })

      expect(update).not.toHaveBeenCalled()
    })

    it('shows the error message when update rejects', async () => {
      const update = vi.fn().mockRejectedValue({
        error: 'PolarRequestValidationError',
        detail: [{ msg: 'Custom seat error', loc: [], type: '', input: 0 }],
      })
      const checkout = createSeatCheckout({ seats: 3 })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={update}
          locale="en"
        />,
      )

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Increase seats'))
      })

      await waitFor(() => {
        expect(screen.getByText('Custom seat error')).toBeInTheDocument()
      })
    })

    it('falls back to a generic error message for non-validation errors', async () => {
      const update = vi
        .fn()
        .mockRejectedValue({ error: 'PaymentError', detail: 'oops' })
      const checkout = createSeatCheckout({ seats: 3 })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={update}
          locale="en"
        />,
      )

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Increase seats'))
      })

      await waitFor(() => {
        expect(screen.getByText(/Failed to update seats/i)).toBeInTheDocument()
      })
    })
  })

  describe('inline edit mode', () => {
    it('updates seats when a new value is typed and the input blurs', async () => {
      const update = vi.fn().mockResolvedValue({} as ProductCheckoutPublic)
      const checkout = createSeatCheckout({ seats: 3 })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={update}
          locale="en"
        />,
      )

      fireEvent.click(screen.getByLabelText('Click to edit seat count'))

      const input = screen.getByDisplayValue('3') as HTMLInputElement

      await act(async () => {
        fireEvent.change(input, { target: { value: '7' } })
        fireEvent.blur(input)
      })

      expect(update).toHaveBeenCalledWith({ seats: 7 })
    })

    it('ignores non-numeric input', () => {
      const checkout = createSeatCheckout({ seats: 3 })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
        />,
      )

      fireEvent.click(screen.getByLabelText('Click to edit seat count'))
      const input = screen.getByDisplayValue('3') as HTMLInputElement

      fireEvent.change(input, { target: { value: 'abc' } })

      expect(input.value).toBe('3')
    })
  })

  describe('auto-correct effect', () => {
    it('issues an update when the checkout seats are below the minimum', async () => {
      const update = vi.fn().mockResolvedValue({} as ProductCheckoutPublic)
      const checkout = createSeatCheckout({
        seats: 1,
        min_seats: 5,
        max_seats: null,
      })

      await act(async () => {
        render(
          <CheckoutSeatSelector
            checkout={checkout}
            update={update}
            locale="en"
          />,
        )
      })

      expect(update).toHaveBeenCalledWith({ seats: 5 })
    })
  })

  describe('button disabled states', () => {
    it('disables decrease button at minimum seats', () => {
      const checkout = createSeatCheckout({
        seats: 1,
        min_seats: null,
        max_seats: null,
      })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
        />,
      )

      expect(screen.getByLabelText('Decrease seats')).toBeDisabled()
      expect(screen.getByLabelText('Increase seats')).not.toBeDisabled()
    })

    it('disables increase button at maximum seats', () => {
      const checkout = createSeatCheckout({
        seats: 5,
        min_seats: null,
        max_seats: 5,
        product_price: createSeatBasedPrice({
          seat_tiers: {
            seat_tier_type: 'volume',
            tiers: [{ min_seats: 1, max_seats: null, price_per_seat: 1000 }],
            minimum_seats: 1,
            maximum_seats: null,
          },
        }),
      })

      render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
        />,
      )

      expect(screen.getByLabelText('Increase seats')).toBeDisabled()
      expect(screen.getByLabelText('Decrease seats')).not.toBeDisabled()
    })
  })
})
