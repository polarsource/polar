import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  createCheckout,
  createFixedPrice,
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
          price={checkout.product_price}
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
          price={checkout.product_price}
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
        net_amount: 3000,
        total_amount: 3000,
        product_price: seatPrice,
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
        net_amount: 3000,
        tax_amount: 750,
        total_amount: 3750,
        product_price: seatPrice,
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

    it('shows "From" minimum seat total when not selected', () => {
      const checkout = createCheckout({
        net_amount: 3000,
        total_amount: 3000,
        product_price: seatPrice,
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

      expect(getRenderedText(container)).toBe('From\u00a0$10')
    })

    it('shows "From" minimum seat total for multi-seat minimum when not selected', () => {
      const multiSeatPrice = createSeatBasedPrice({
        id: 'price_seat_5min',
        seat_tiers: {
          seat_tier_type: 'volume',
          tiers: [{ min_seats: 5, max_seats: null, price_per_seat: 1000 }],
          minimum_seats: 5,
          maximum_seats: null,
        },
      })

      const checkout = createCheckout({
        net_amount: 5000,
        total_amount: 5000,
        product_price: multiSeatPrice,
      })

      const { container } = render(
        <CheckoutProductSwitcherItemPrice
          isSelected={false}
          product={checkout.product}
          price={multiSeatPrice}
          checkout={checkout}
          locale="en"
        />,
      )

      expect(getRenderedText(container)).toBe('From\u00a0$50')
    })
  })

  describe('fixed + seat price', () => {
    const fixedPrice = createFixedPrice({
      id: 'price_fixed',
      price_amount: 2900,
    })
    const seatPrice = createSeatBasedPrice({
      id: 'price_seat',
      seat_tiers: {
        seat_tier_type: 'volume',
        tiers: [{ min_seats: 1, max_seats: null, price_per_seat: 2000 }],
        minimum_seats: 1,
        maximum_seats: null,
      },
    })

    const fixedSeatCheckout = () =>
      createCheckout({
        net_amount: 12900,
        total_amount: 12900,
        seats: 5,
        product_price: seatPrice,
        prices: { prod_1: [fixedPrice, seatPrice] },
      })

    it('shows the decomposed base + per-seat label when selected', () => {
      const checkout = fixedSeatCheckout()
      const { container } = render(
        <CheckoutProductSwitcherItemPrice
          isSelected={true}
          product={checkout.product}
          price={seatPrice}
          checkout={checkout}
          locale="en"
        />,
      )

      const text = getRenderedText(container)
      expect(text).toContain('$29')
      expect(text).toContain('$20')
      expect(text).toContain('per seat')
    })

    it('shows the same decomposed label when not selected', () => {
      const checkout = fixedSeatCheckout()
      const { container } = render(
        <CheckoutProductSwitcherItemPrice
          isSelected={false}
          product={checkout.product}
          price={seatPrice}
          checkout={checkout}
          locale="en"
        />,
      )

      const text = getRenderedText(container)
      expect(text).toContain('$29')
      expect(text).toContain('$20')
      expect(text).toContain('per seat')
      expect(text).not.toContain('From')
    })
  })

  describe('free price', () => {
    it('shows "Free"', () => {
      const freePrice = createFreePrice({ id: 'price_free' })
      const checkout = createCheckout({
        amount: 0,
        net_amount: 0,
        total_amount: 0,
        is_free_product_price: true,
        product_price: freePrice,
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
