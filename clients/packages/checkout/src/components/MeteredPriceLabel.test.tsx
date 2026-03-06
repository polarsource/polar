import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createMeteredPrice } from '../test-utils/makeCheckout'
import MeteredPriceLabel from './MeteredPriceLabel'

describe('MeteredPriceLabel', () => {
  it('renders unit amount with "/ unit" suffix', () => {
    const price = createMeteredPrice({ unitAmount: '500' })

    const { container } = render(
      <MeteredPriceLabel price={price} locale="en" />,
    )

    expect(container.textContent).toContain('$5')
    expect(container.textContent).toContain('/ unit')
  })

  it('renders fractional unit amount', () => {
    const price = createMeteredPrice({ unitAmount: '0.05' })

    const { container } = render(
      <MeteredPriceLabel price={price} locale="en" />,
    )

    expect(container.textContent).toContain('$0.0005')
    expect(container.textContent).toContain('/ unit')
  })

  it('renders sub-cent amount', () => {
    const price = createMeteredPrice({ unitAmount: '0.005' })

    const { container } = render(
      <MeteredPriceLabel price={price} locale="en" />,
    )

    expect(container.textContent).toContain('$0.00005')
    expect(container.textContent).toContain('/ unit')
  })

  it('renders with different currency', () => {
    const price = createMeteredPrice({
      unitAmount: '10',
      priceCurrency: 'eur',
    })

    const { container } = render(
      <MeteredPriceLabel price={price} locale="en" />,
    )

    expect(container.textContent).toContain('€')
    expect(container.textContent).toContain('/ unit')
  })

  it('renders zero unit amount', () => {
    const price = createMeteredPrice({ unitAmount: '0' })

    const { container } = render(
      <MeteredPriceLabel price={price} locale="en" />,
    )

    expect(container.textContent).toContain('$0')
    expect(container.textContent).toContain('/ unit')
  })
})
