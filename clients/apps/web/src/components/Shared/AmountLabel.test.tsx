import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AmountLabel from './AmountLabel'

describe('AmountLabel', () => {
  it('keeps abbreviated intervals by default', () => {
    const { container } = render(
      <AmountLabel amount={1000} currency="usd" interval="month" />,
    )

    expect(container.textContent).toContain('/ mo')
    expect(container.textContent).not.toContain('one-time')
  })

  it('spells out the interval when there is room', () => {
    const { container } = render(
      <AmountLabel
        amount={1000}
        currency="usd"
        interval="year"
        intervalCount={2}
        fullInterval
      />,
    )

    expect(container.textContent).toContain('/ every 2nd year')
    expect(container.textContent).not.toContain('/ yr')
  })

  it('labels a one-time amount when there is room', () => {
    const { container } = render(
      <AmountLabel amount={2500} currency="usd" fullInterval />,
    )

    expect(container.textContent).toContain('one-time')
    expect(container.textContent).not.toContain('/')
  })
})
