import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  createCheckout,
  createFreePrice,
  createSeatBasedPrice,
} from '../test-utils/makeCheckout'
import { CheckoutProductSwitcherItemPrice } from './CheckoutProductSwitcher'

function getRenderedText(container: HTMLElement): string {
  return container.textContent?.trim() ?? ''
}

describe('CheckoutProductSwitcherItemPrice', () => {
  describe('fixed price (non-seat-based)', () => {
    it('shows catalog price via ProductPriceLabel', () => {
      const checkout = createCheckout()
      const { container } = render(
        <CheckoutProductSwitcherItemPrice
          isSelected={true}
          product={checkout.product}
          price={checkout.productPrice}
          checkout={checkout}
          locale="en"
        />,
      )

      expect(getRenderedText(container)).toBe('$9.99')
    })

    it('shows catalog price even when not selected', () => {
      const checkout = createCheckout()
      const { container } = render(
        <CheckoutProductSwitcherItemPrice
          isSelected={false}
          product={checkout.product}
          price={checkout.productPrice}
          checkout={checkout}
          locale="en"
        />,
      )

      expect(getRenderedText(container)).toBe('$9.99')
    })
  })

  describe('seat-based price, selected', () => {
    const seatPrice = createSeatBasedPrice({ id: 'price_seat' })

    it('shows netAmount when selected (current behavior, no tax)', () => {
      const checkout = createCheckout({
        netAmount: 3000,
        totalAmount: 3000,
        productPrice: seatPrice,
      })

      const { container } = render(
        <CheckoutProductSwitcherItemPrice
          isSelected={true}
          product={checkout.product}
          price={seatPrice}
          checkout={checkout}
          locale="en"
        />,
      )

      expect(getRenderedText(container)).toBe('$30')
    })

    it('shows netAmount not totalAmount when tax present (current behavior)', () => {
      const checkout = createCheckout({
        netAmount: 3000,
        taxAmount: 750,
        totalAmount: 3750,
        productPrice: seatPrice,
      })

      const { container } = render(
        <CheckoutProductSwitcherItemPrice
          isSelected={true}
          product={checkout.product}
          price={seatPrice}
          checkout={checkout}
          locale="en"
        />,
      )

      expect(getRenderedText(container)).toBe('$30')
    })

    it('shows catalog per-seat price when not selected', () => {
      const checkout = createCheckout({
        netAmount: 3000,
        totalAmount: 3000,
        productPrice: seatPrice,
      })

      const { container } = render(
        <CheckoutProductSwitcherItemPrice
          isSelected={false}
          product={checkout.product}
          price={seatPrice}
          checkout={checkout}
          locale="en"
        />,
      )

      expect(getRenderedText(container)).toBe('$10')
    })
  })

  describe('free price', () => {
    it('shows "Free"', () => {
      const freePrice = createFreePrice({ id: 'price_free' })
      const checkout = createCheckout({
        amount: 0,
        netAmount: 0,
        totalAmount: 0,
        isFreeProductPrice: true,
        productPrice: freePrice,
      })

      const { container } = render(
        <CheckoutProductSwitcherItemPrice
          isSelected={true}
          product={checkout.product}
          price={freePrice}
          checkout={checkout}
          locale="en"
        />,
      )

      expect(getRenderedText(container)).toBe('Free')
    })
  })
})
