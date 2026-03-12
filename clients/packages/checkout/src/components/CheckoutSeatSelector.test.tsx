import { render, screen } from '@testing-library/react'
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
  price_per_seat: 1049,
  product_price: createSeatBasedPrice({
    seat_tiers: {
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

    it('shows per-seat price', () => {
      const checkout = createSeatCheckout()

      const { container } = render(
        <CheckoutSeatSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
        />,
      )

      const perSeatText = container.querySelector('p')
      expect(perSeatText?.textContent).toContain('$10.49')
      expect(perSeatText?.textContent).toContain('per seat')
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
    it('shows "Seats" label and per-seat price', () => {
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
      expect(screen.getByText(/\$10\.49.*per seat/)).toBeInTheDocument()
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
