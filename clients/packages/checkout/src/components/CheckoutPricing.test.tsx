import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ProductCheckoutPublic } from '../guards'
import {
  createCheckout,
  createCustomPrice,
  createFreePrice,
} from '../test-utils/makeCheckout'
import CheckoutPricing from './CheckoutPricing'

describe('CheckoutPricing', () => {
  describe('fixed price, no discount', () => {
    it('shows the catalog price (price.priceAmount)', () => {
      const checkout = createCheckout({
        amount: 999,
        netAmount: 999,
        totalAmount: 999,
        taxAmount: null,
      })

      render(<CheckoutPricing checkout={checkout} locale="en" />)

      expect(screen.getByTestId('headline-price')).toHaveTextContent('$9.99')
    })
  })

  describe('fixed price, no discount, with tax', () => {
    it('shows the catalog price (does NOT include tax — current behavior)', () => {
      const checkout = createCheckout({
        amount: 999,
        netAmount: 999,
        taxAmount: 250,
        totalAmount: 1249,
      })

      render(<CheckoutPricing checkout={checkout} locale="en" />)

      expect(screen.getByTestId('headline-price')).toHaveTextContent('$9.99')
    })
  })

  describe('fixed price, with discount, no tax', () => {
    it('shows netAmount (discounted price, current behavior)', () => {
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

      render(<CheckoutPricing checkout={checkout} locale="en" />)

      expect(screen.getByTestId('headline-price').textContent).toContain(
        '$15.99',
      )
    })
  })

  describe('fixed price, with discount and tax', () => {
    it('shows netAmount (does NOT include tax — current behavior)', () => {
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

      render(<CheckoutPricing checkout={checkout} locale="en" />)

      expect(screen.getByTestId('headline-price').textContent).toContain(
        '$15.99',
      )
    })
  })

  describe('custom (PWYW) price', () => {
    it('shows checkout.amount', () => {
      const checkout = createCheckout({
        amount: 1550,
        netAmount: 1550,
        totalAmount: 1550,
        productPrice: createCustomPrice({ presetAmount: 1550 }),
      })

      render(<CheckoutPricing checkout={checkout} locale="en" />)

      expect(screen.getByTestId('headline-price')).toHaveTextContent('$15.50')
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

      render(<CheckoutPricing checkout={checkout} locale="en" />)

      expect(screen.getByTestId('headline-price')).toHaveTextContent('Free')
    })
  })
})
