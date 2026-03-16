import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createMeteredPrice } from '../test-utils/makeCheckout'
import MeteredPriceLabel from './MeteredPriceLabel'

describe('MeteredPriceLabel', () => {
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
