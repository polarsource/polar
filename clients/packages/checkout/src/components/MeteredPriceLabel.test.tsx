import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createMeteredPrice } from '../test-utils/makeCheckout'
import MeteredPriceLabel from './MeteredPriceLabel'

describe('MeteredPriceLabel', () => {
  describe('scalar unit (default)', () => {
    it('renders unit amount with "/ unit" suffix', () => {
      const price = createMeteredPrice({ unit_amount: '500' })

      const { container } = render(
        <MeteredPriceLabel price={price} locale="en" />,
      )

      expect(container.textContent).toContain('$5')
      expect(container.textContent).toContain('/ unit')
    })

    it('renders fractional unit amount', () => {
      const price = createMeteredPrice({ unit_amount: '0.05' })

      const { container } = render(
        <MeteredPriceLabel price={price} locale="en" />,
      )

      expect(container.textContent).toContain('$0.0005')
      expect(container.textContent).toContain('/ unit')
    })

    it('renders sub-cent amount', () => {
      const price = createMeteredPrice({ unit_amount: '0.005' })

      const { container } = render(
        <MeteredPriceLabel price={price} locale="en" />,
      )

      expect(container.textContent).toContain('$0.00005')
      expect(container.textContent).toContain('/ unit')
    })

    it('renders with different currency', () => {
      const price = createMeteredPrice({
        unit_amount: '10',
        price_currency: 'eur',
      })

      const { container } = render(
        <MeteredPriceLabel price={price} locale="en" />,
      )

      expect(container.textContent).toContain('€')
      expect(container.textContent).toContain('/ unit')
    })

    it('renders zero unit amount', () => {
      const price = createMeteredPrice({ unit_amount: '0' })

      const { container } = render(
        <MeteredPriceLabel price={price} locale="en" />,
      )

      expect(container.textContent).toContain('$0')
      expect(container.textContent).toContain('/ unit')
    })
  })

  describe('tokens unit', () => {
    it('scales price to per 1M tokens', () => {
      // $10 / 1M tokens → unit_amount = 0.001 cents/token
      const price = createMeteredPrice({
        unit_amount: '0.001',
        meter: { id: 'meter_1', name: 'LLM Tokens', unit: 'tokens' },
      })

      const { container } = render(
        <MeteredPriceLabel price={price} locale="en" />,
      )

      expect(container.textContent).toContain('$10')
      expect(container.textContent).toContain('/ 1M tokens')
    })

    it('renders small per-token price correctly', () => {
      // $0.50 / 1M tokens → unit_amount = 0.0000005 cents/token
      const price = createMeteredPrice({
        unit_amount: '0.0000005',
        meter: { id: 'meter_1', name: 'LLM Tokens', unit: 'tokens' },
      })

      const { container } = render(
        <MeteredPriceLabel price={price} locale="en" />,
      )

      expect(container.textContent).toContain('/ 1M tokens')
    })
  })

  describe('bytes unit', () => {
    it('scales price to per GB', () => {
      // $0.023 / GB → unit_amount = 2.3e-9 cents/byte
      const price = createMeteredPrice({
        unit_amount: '0.0000000023',
        meter: { id: 'meter_1', name: 'Bandwidth', unit: 'bytes' },
      })

      const { container } = render(
        <MeteredPriceLabel price={price} locale="en" />,
      )

      expect(container.textContent).toContain('/ GB')
    })

    it('shows GB label', () => {
      const price = createMeteredPrice({
        unit_amount: '0.000000001',
        meter: { id: 'meter_1', name: 'Storage', unit: 'bytes' },
      })

      const { container } = render(
        <MeteredPriceLabel price={price} locale="en" />,
      )

      expect(container.textContent).toContain('/ GB')
    })
  })

  describe('seconds unit', () => {
    it('scales price to per hour', () => {
      // $2.50 / hour → unit_amount = 250/3600 ≈ 0.0694 cents/second
      const price = createMeteredPrice({
        unit_amount: String(250 / 3600),
        meter: { id: 'meter_1', name: 'Compute', unit: 'seconds' },
      })

      const { container } = render(
        <MeteredPriceLabel price={price} locale="en" />,
      )

      expect(container.textContent).toContain('$2.50')
      expect(container.textContent).toContain('/ hour')
    })

    it('shows hour label', () => {
      const price = createMeteredPrice({
        unit_amount: String(100 / 3600),
        meter: { id: 'meter_1', name: 'Compute', unit: 'seconds' },
      })

      const { container } = render(
        <MeteredPriceLabel price={price} locale="en" />,
      )

      expect(container.textContent).toContain('/ hour')
    })
  })
})
