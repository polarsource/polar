import type { schemas } from '@polar-sh/client'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  createCustomPrice,
  createFixedPrice,
  createFreePrice,
  createMeteredPrice,
  createSeatBasedPrice,
} from '../test-utils/makeCheckout'
import ProductPriceLabel from './ProductPriceLabel'

const now = new Date()

const baseProduct: schemas['CheckoutProduct'] = {
  id: 'prod_1',
  name: 'Test Product',
  recurring_interval: null,
  recurring_interval_count: null,
  is_recurring: false,
  trial_interval: null,
  trial_interval_count: null,
  visibility: 'public',
  prices: [],
  benefits: [],
  medias: [],
  description: null,
  is_archived: false,
  organization_id: 'org_1',
  created_at: now.toISOString(),
  modified_at: null,
}

function getText(container: HTMLElement): string {
  return container.textContent?.trim() ?? ''
}

describe('ProductPriceLabel', () => {
  describe('fixed price, one-time', () => {
    it('shows the price amount', () => {
      const price = createFixedPrice({ price_amount: 2499 })
      const { container } = render(
        <ProductPriceLabel product={baseProduct} price={price} locale="en" />,
      )
      expect(getText(container)).toBe('$24.99')
    })
  })

  describe('fixed price, monthly recurring', () => {
    it('shows price with monthly interval suffix', () => {
      const price = createFixedPrice({ price_amount: 999 })
      const product = {
        ...baseProduct,
        recurring_interval: 'month' as const,
      }
      const { container } = render(
        <ProductPriceLabel product={product} price={price} locale="en" />,
      )
      expect(getText(container)).toContain('$9.99')
      expect(getText(container)).toContain('/ mo')
    })
  })

  describe('fixed price, yearly recurring', () => {
    it('shows price with yearly interval suffix', () => {
      const price = createFixedPrice({ price_amount: 9950 })
      const product = {
        ...baseProduct,
        recurring_interval: 'year' as const,
      }
      const { container } = render(
        <ProductPriceLabel product={product} price={price} locale="en" />,
      )
      expect(getText(container)).toContain('$99.50')
      expect(getText(container)).toContain('/ yr')
    })
  })

  describe('custom (PWYW) price', () => {
    it('shows "Pay what you want"', () => {
      const price = createCustomPrice()
      const { container } = render(
        <ProductPriceLabel product={baseProduct} price={price} locale="en" />,
      )
      expect(getText(container)).toBe('Pay what you want')
    })
  })

  describe('free price', () => {
    it('shows "Free"', () => {
      const price = createFreePrice()
      const { container } = render(
        <ProductPriceLabel product={baseProduct} price={price} locale="en" />,
      )
      expect(getText(container)).toBe('Free')
    })
  })

  describe('seat-based price', () => {
    it('shows base tier price per seat', () => {
      const price = createSeatBasedPrice({
        seat_tiers: {
          seat_tier_type: 'volume',
          tiers: [
            { min_seats: 1, max_seats: 10, price_per_seat: 549 },
            { min_seats: 11, max_seats: null, price_per_seat: 449 },
          ],
          minimum_seats: 1,
          maximum_seats: null,
        },
      })
      const { container } = render(
        <ProductPriceLabel product={baseProduct} price={price} locale="en" />,
      )
      expect(getText(container)).toContain('$5.49')
    })
  })

  describe('metered unit price', () => {
    it('shows meter name and per-unit price', () => {
      const price = createMeteredPrice({
        unit_amount: '0.05',
        meter: { id: 'meter_1', name: 'API Calls', unit: 'scalar' as const },
      })
      const { container } = render(
        <ProductPriceLabel product={baseProduct} price={price} locale="en" />,
      )
      expect(getText(container)).toContain('API Calls')
      expect(getText(container)).toContain('$0.0005')
    })
  })
})
