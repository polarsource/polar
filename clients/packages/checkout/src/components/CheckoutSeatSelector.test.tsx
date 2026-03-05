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
  netAmount: 3147,
  taxAmount: null,
  totalAmount: 3147,
  seats: 3,
  minSeats: null,
  maxSeats: null,
  pricePerSeat: 1049,
  productPrice: createSeatBasedPrice({
    seatTiers: {
      tiers: [{ minSeats: 1, maxSeats: null, pricePerSeat: 1049 }],
      minimumSeats: 1,
      maximumSeats: null,
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
        netAmount: 3147,
        totalAmount: 3147,
        taxAmount: null,
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
        netAmount: 3147,
        taxAmount: 787,
        totalAmount: 3934,
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
        productPrice: createFixedPrice(),
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
        discountAmount: 629,
        netAmount: 2518,
        taxAmount: null,
        totalAmount: 2518,
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basisPoints: 2000,
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
        discountAmount: 629,
        netAmount: 2518,
        taxAmount: 630,
        totalAmount: 3148,
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basisPoints: 2000,
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
        minSeats: 5,
        maxSeats: 5,
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
        minSeats: 5,
        maxSeats: 5,
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
        minSeats: 3,
        maxSeats: null,
        productPrice: createSeatBasedPrice({
          seatTiers: {
            tiers: [{ minSeats: 1, maxSeats: null, pricePerSeat: 1000 }],
            minimumSeats: 1,
            maximumSeats: null,
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
        minSeats: null,
        maxSeats: 10,
        productPrice: createSeatBasedPrice({
          seatTiers: {
            tiers: [{ minSeats: 1, maxSeats: null, pricePerSeat: 1000 }],
            minimumSeats: 1,
            maximumSeats: null,
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
        minSeats: 3,
        maxSeats: 10,
        productPrice: createSeatBasedPrice({
          seatTiers: {
            tiers: [{ minSeats: 1, maxSeats: null, pricePerSeat: 1000 }],
            minimumSeats: 1,
            maximumSeats: null,
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
        minSeats: null,
        maxSeats: null,
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
        minSeats: null,
        maxSeats: 5,
        productPrice: createSeatBasedPrice({
          seatTiers: {
            tiers: [{ minSeats: 1, maxSeats: null, pricePerSeat: 1000 }],
            minimumSeats: 1,
            maximumSeats: null,
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
