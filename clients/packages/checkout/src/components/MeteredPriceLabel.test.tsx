import { schemas } from '@polar-sh/client'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createMeteredPrice } from '../test-utils/makeCheckout'
import MeteredPriceLabel from './MeteredPriceLabel'

const percentageDiscount = (basisPoints: number) =>
  ({
    id: 'disc_1',
    name: 'test',
    type: 'percentage',
    duration: 'once',
    code: null,
    basis_points: basisPoints,
  }) satisfies schemas['CheckoutPublic']['discount']

const fixedDiscount = {
  id: 'disc_1',
  name: '$5 off',
  type: 'fixed',
  duration: 'once',
  code: null,
  amount: 500,
  currency: 'usd',
  amounts: { usd: 500 },
} satisfies schemas['CheckoutPublic']['discount']

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

  describe('with percentage discount', () => {
    it('renders original rate with line-through and discounted rate alongside', () => {
      const price = createMeteredPrice({ unit_amount: '900' })

      render(
        <MeteredPriceLabel
          price={price}
          locale="en"
          discount={percentageDiscount(5000)}
        />,
      )

      expect(screen.getByText('$9.00')).toHaveClass('line-through')
      expect(screen.getByText('$4.50')).toBeInTheDocument()
    })

    it('renders $0 as the discounted rate for a 100% discount', () => {
      const price = createMeteredPrice({ unit_amount: '900' })

      render(
        <MeteredPriceLabel
          price={price}
          locale="en"
          discount={percentageDiscount(10000)}
        />,
      )

      expect(screen.getByText('$9.00')).toHaveClass('line-through')
      expect(screen.getByText('$0.00')).toBeInTheDocument()
    })

    it('applies the discount to scaled (per-1M tokens) rates', () => {
      const price = createMeteredPrice({
        unit_amount: '0.001',
        meter: { id: 'meter_1', name: 'LLM Tokens', unit: 'token' },
      })

      render(
        <MeteredPriceLabel
          price={price}
          locale="en"
          discount={percentageDiscount(5000)}
        />,
      )

      expect(screen.getByText('$10.00')).toHaveClass('line-through')
      expect(screen.getByText('$5.00')).toBeInTheDocument()
    })
  })

  describe('with fixed discount', () => {
    it('renders the plain rate without a strike-through', () => {
      const price = createMeteredPrice({ unit_amount: '900' })

      const { container } = render(
        <MeteredPriceLabel
          price={price}
          locale="en"
          discount={fixedDiscount}
        />,
      )

      expect(container.textContent).toContain('$9.00')
      expect(container.querySelector('.line-through')).toBeNull()
    })
  })

  describe('without discount', () => {
    it('renders a single rate', () => {
      const price = createMeteredPrice({ unit_amount: '900' })

      const { container } = render(
        <MeteredPriceLabel price={price} locale="en" />,
      )

      expect(container.textContent).toContain('$9.00')
      expect(container.querySelector('.line-through')).toBeNull()
    })
  })
})
