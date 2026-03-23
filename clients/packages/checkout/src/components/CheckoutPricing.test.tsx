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
    it('shows the catalog price (price.price_amount)', () => {
      const checkout = createCheckout({
        amount: 999,
        net_amount: 999,
        total_amount: 999,
        tax_amount: null,
      })

      render(<CheckoutPricing checkout={checkout} locale="en" />)

      expect(screen.getByTestId('headline-price')).toHaveTextContent('$9.99')
    })
  })

  describe('fixed price, no discount, with tax', () => {
    it('shows the total price including tax', () => {
      const checkout = createCheckout({
        amount: 999,
        net_amount: 999,
        tax_amount: 250,
        total_amount: 1249,
      })

      render(<CheckoutPricing checkout={checkout} locale="en" />)

      expect(screen.getByTestId('headline-price')).toHaveTextContent('$12.49')
    })
  })

  describe('fixed price, with discount, no tax', () => {
    it('shows netAmount (discounted price, current behavior)', () => {
      const checkout = createCheckout({
        amount: 1999,
        discount_amount: 400,
        net_amount: 1599,
        tax_amount: null,
        total_amount: 1599,
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basis_points: 2000,
        } as ProductCheckoutPublic['discount'],
      })

      render(<CheckoutPricing checkout={checkout} locale="en" />)

      expect(screen.getByTestId('headline-price').textContent).toContain(
        '$15.99',
      )
    })
  })

  describe('fixed price, with discount and tax', () => {
    it('shows total price including tax', () => {
      const checkout = createCheckout({
        amount: 1999,
        discount_amount: 400,
        net_amount: 1599,
        tax_amount: 400,
        total_amount: 1999,
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basis_points: 2000,
        } as ProductCheckoutPublic['discount'],
      })

      render(<CheckoutPricing checkout={checkout} locale="en" />)

      expect(screen.getByTestId('headline-price').textContent).toContain(
        '$19.99',
      )
    })
  })

  describe('custom (PWYW) price', () => {
    it('shows checkout.amount', () => {
      const checkout = createCheckout({
        amount: 1550,
        net_amount: 1550,
        total_amount: 1550,
        product_price: createCustomPrice({ preset_amount: 1550 }),
      })

      render(<CheckoutPricing checkout={checkout} locale="en" />)

      expect(screen.getByTestId('headline-price')).toHaveTextContent('$15.50')
    })
  })

  describe('free product', () => {
    it('renders "$0"', () => {
      const checkout = createCheckout({
        amount: 0,
        net_amount: 0,
        total_amount: 0,
        is_free_product_price: true,
        product_price: createFreePrice(),
      })

      render(<CheckoutPricing checkout={checkout} locale="en" />)

      expect(screen.getByTestId('headline-price')).toHaveTextContent('$0')
    })
  })
})
