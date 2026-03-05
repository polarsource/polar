import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  createCheckout,
  createFixedPrice,
  createMeteredPrice,
} from '../test-utils/makeCheckout'
import MeteredPricesDisplay from './MeteredPricesDisplay'

describe('MeteredPricesDisplay', () => {
  describe('no metered prices', () => {
    it('renders nothing when prices array has no metered prices', () => {
      const checkout = createCheckout({
        prices: {
          prod_1: [createFixedPrice()],
        },
      })

      const { container } = render(
        <MeteredPricesDisplay checkout={checkout} locale="en" />,
      )

      expect(container.innerHTML).toBe('')
    })

    it('renders nothing when prices array is empty', () => {
      const checkout = createCheckout({
        prices: { prod_1: [] },
      })

      const { container } = render(
        <MeteredPricesDisplay checkout={checkout} locale="en" />,
      )

      expect(container.innerHTML).toBe('')
    })
  })

  describe('with metered prices', () => {
    it('shows metered price with meter name and per-unit cost', () => {
      const fixedPrice = createFixedPrice({ id: 'price_fixed' })
      const meteredPrice = createMeteredPrice({
        unitAmount: '0.05',
        meter: { id: 'meter_1', name: 'API Calls' },
      })

      const checkout = createCheckout({
        productPrice: fixedPrice,
        prices: {
          prod_1: [fixedPrice, meteredPrice],
        },
      })

      const { container } = render(
        <MeteredPricesDisplay checkout={checkout} locale="en" />,
      )

      expect(container.textContent).toContain('API Calls')
      expect(container.textContent).toContain('$0.0005')
    })

    it('filters out the currently selected price', () => {
      const meteredPrice = createMeteredPrice({ id: 'price_metered_only' })

      const checkout = createCheckout({
        productPrice: meteredPrice,
        prices: {
          prod_1: [meteredPrice],
        },
      })

      const { container } = render(
        <MeteredPricesDisplay checkout={checkout} locale="en" />,
      )

      expect(container.innerHTML).toBe('')
    })

    it('shows multiple metered prices', () => {
      const fixedPrice = createFixedPrice({ id: 'price_fixed' })
      const meteredPrice1 = createMeteredPrice({
        id: 'price_metered_1',
        meter: { id: 'meter_1', name: 'API Calls' },
      })
      const meteredPrice2 = createMeteredPrice({
        id: 'price_metered_2',
        unitAmount: '0.02',
        meterId: 'meter_2',
        meter: { id: 'meter_2', name: 'Storage (GB)' },
      })

      const checkout = createCheckout({
        productPrice: fixedPrice,
        prices: {
          prod_1: [fixedPrice, meteredPrice1, meteredPrice2],
        },
      })

      const { container } = render(
        <MeteredPricesDisplay checkout={checkout} locale="en" />,
      )

      expect(container.textContent).toContain('API Calls')
      expect(container.textContent).toContain('Storage (GB)')
    })
  })
})
