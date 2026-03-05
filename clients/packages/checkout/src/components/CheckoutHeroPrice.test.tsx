import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ProductCheckoutPublic } from '../guards'
import {
  createCheckout,
  createCustomPrice,
  createFreePrice,
  createSeatBasedPrice,
} from '../test-utils/makeCheckout'
import CheckoutHeroPrice from './CheckoutHeroPrice'

describe('CheckoutHeroPrice', () => {
  describe('fixed price, no discount, no tax', () => {
    it('renders the catalog price (price.priceAmount)', () => {
      const checkout = createCheckout({
        amount: 999,
        netAmount: 999,
        totalAmount: 999,
        taxAmount: null,
      })

      render(<CheckoutHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('$9.99')).toBeInTheDocument()
    })
  })

  describe('fixed price, no discount, with tax', () => {
    it('still renders the catalog price (does NOT include tax)', () => {
      const checkout = createCheckout({
        amount: 999,
        netAmount: 999,
        taxAmount: 250,
        totalAmount: 1249,
      })

      render(<CheckoutHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getAllByText('$9.99').length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('fixed price, with discount, no tax', () => {
    it('renders totalAmount (discounted price)', () => {
      const checkout = createCheckout({
        amount: 1999,
        discountAmount: 400,
        netAmount: 1599,
        taxAmount: null,
        totalAmount: 1599,
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basisPoints: 2000,
        } as ProductCheckoutPublic['discount'],
      })

      render(<CheckoutHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('$15.99')).toBeInTheDocument()
    })
  })

  describe('fixed price, with discount and tax', () => {
    it('renders totalAmount (includes tax)', () => {
      const checkout = createCheckout({
        amount: 1999,
        discountAmount: 400,
        netAmount: 1599,
        taxAmount: 400,
        totalAmount: 1999,
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basisPoints: 2000,
        } as ProductCheckoutPublic['discount'],
      })

      render(<CheckoutHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('$19.99')).toBeInTheDocument()
    })
  })

  describe('custom (PWYW) price', () => {
    it('renders checkout.amount', () => {
      const checkout = createCheckout({
        amount: 1550,
        netAmount: 1550,
        totalAmount: 1550,
        productPrice: createCustomPrice({ presetAmount: 1550 }),
      })

      render(<CheckoutHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('$15.50')).toBeInTheDocument()
    })
  })

  describe('seat-based pricing', () => {
    it('renders totalAmount', () => {
      const checkout = createCheckout({
        amount: 3147,
        netAmount: 3147,
        taxAmount: null,
        totalAmount: 3147,
        productPrice: createSeatBasedPrice(),
      })

      render(<CheckoutHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('$31.47')).toBeInTheDocument()
    })
  })

  describe('free product', () => {
    it('renders "Free"', () => {
      const checkout = createCheckout({
        amount: 0,
        netAmount: 0,
        totalAmount: 0,
        isFreeProductPrice: true,
        productPrice: createFreePrice(),
      })

      render(<CheckoutHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('Free')).toBeInTheDocument()
    })
  })
})
