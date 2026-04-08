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

  describe('token unit', () => {
    it('scales price to per 1M tokens', () => {
      // $10 / 1M tokens → unit_amount = 0.001 cents/token
      const price = createMeteredPrice({
        unit_amount: '0.001',
        meter: { id: 'meter_1', name: 'LLM Tokens', unit: 'token' },
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
        meter: { id: 'meter_1', name: 'LLM Tokens', unit: 'token' },
      })

      const { container } = render(
        <MeteredPriceLabel price={price} locale="en" />,
      )

      expect(container.textContent).toContain('/ 1M tokens')
    })
  })

  describe('custom unit', () => {
    it('uses customMultiplier as scale and customLabel as label', () => {
      // $5 / 1000 requests → unit_amount = 0.5 cents/request
      const price = createMeteredPrice({
        unit_amount: '0.5',
        meter: {
          id: 'meter_1',
          name: 'API Calls',
          unit: 'custom',
          custom_label: 'request',
          custom_multiplier: 1000,
        },
      })

      const { container } = render(
        <MeteredPriceLabel price={price} locale="en" />,
      )

      expect(container.textContent).toContain('$5')
      expect(container.textContent).toContain('/ request')
    })

    it('falls back to "unit" label when custom_label is null', () => {
      const price = createMeteredPrice({
        unit_amount: '1',
        meter: {
          id: 'meter_1',
          name: 'Events',
          unit: 'custom',
          custom_label: null,
          custom_multiplier: 100,
        },
      })

      const { container } = render(
        <MeteredPriceLabel price={price} locale="en" />,
      )

      expect(container.textContent).toContain('/ unit')
    })
  })
})
