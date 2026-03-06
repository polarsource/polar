import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AmountLabel from './AmountLabel'

describe('AmountLabel', () => {
  describe('one-time (no interval)', () => {
    it('renders standard formatted amount', () => {
      const { container } = render(
        <AmountLabel
          amount={1999}
          currency="usd"
          mode="standard"
          locale="en"
        />,
      )
      expect(container.textContent).toBe('$19.99')
    })

    it('renders compact formatted amount', () => {
      const { container } = render(
        <AmountLabel amount={1999} currency="usd" mode="compact" locale="en" />,
      )
      expect(container.textContent).toBe('$19.99')
    })

    it('renders zero amount', () => {
      const { container } = render(
        <AmountLabel amount={0} currency="usd" mode="standard" locale="en" />,
      )
      expect(container.textContent).toBe('$0')
    })

    it('renders large amount with commas', () => {
      const { container } = render(
        <AmountLabel
          amount={1000000}
          currency="usd"
          mode="standard"
          locale="en"
        />,
      )
      expect(container.textContent).toBe('$10,000')
    })
  })

  describe('with recurring interval', () => {
    it('renders monthly interval', () => {
      const { container } = render(
        <AmountLabel
          amount={999}
          currency="usd"
          interval="month"
          mode="standard"
          locale="en"
        />,
      )
      expect(container.textContent).toContain('$9.99')
      expect(container.textContent).toContain('/ mo')
    })

    it('renders yearly interval', () => {
      const { container } = render(
        <AmountLabel
          amount={9999}
          currency="usd"
          interval="year"
          mode="standard"
          locale="en"
        />,
      )
      expect(container.textContent).toContain('$99.99')
      expect(container.textContent).toContain('/ yr')
    })

    it('renders daily interval', () => {
      const { container } = render(
        <AmountLabel
          amount={199}
          currency="usd"
          interval="day"
          mode="standard"
          locale="en"
        />,
      )
      expect(container.textContent).toContain('$1.99')
      expect(container.textContent).toContain('/ dy')
    })

    it('renders weekly interval', () => {
      const { container } = render(
        <AmountLabel
          amount={499}
          currency="usd"
          interval="week"
          mode="standard"
          locale="en"
        />,
      )
      expect(container.textContent).toContain('$4.99')
      expect(container.textContent).toContain('/ wk')
    })
  })

  describe('with intervalCount > 1', () => {
    it('renders ordinal interval count for every 3rd month', () => {
      const { container } = render(
        <AmountLabel
          amount={2999}
          currency="usd"
          interval="month"
          intervalCount={3}
          mode="standard"
          locale="en"
        />,
      )
      expect(container.textContent).toContain('$29.99')
      expect(container.textContent).toContain('3rd')
      expect(container.textContent).toContain('mo')
    })

    it('renders ordinal interval count for every 2nd year', () => {
      const { container } = render(
        <AmountLabel
          amount={19999}
          currency="usd"
          interval="year"
          intervalCount={2}
          mode="standard"
          locale="en"
        />,
      )
      expect(container.textContent).toContain('$199.99')
      expect(container.textContent).toContain('2nd')
      expect(container.textContent).toContain('yr')
    })
  })

  describe('intervalCount = 1 (no ordinal)', () => {
    it('does not show ordinal for intervalCount of 1', () => {
      const { container } = render(
        <AmountLabel
          amount={999}
          currency="usd"
          interval="month"
          intervalCount={1}
          mode="standard"
          locale="en"
        />,
      )
      expect(container.textContent).toContain('$9.99')
      expect(container.textContent).toContain('/ mo')
      expect(container.textContent).not.toContain('1st')
    })
  })

  describe('different currencies', () => {
    it('renders EUR amount', () => {
      const { container } = render(
        <AmountLabel
          amount={1999}
          currency="eur"
          mode="standard"
          locale="en"
        />,
      )
      expect(container.textContent).toContain('€')
      expect(container.textContent).toContain('19.99')
    })

    it('renders GBP amount', () => {
      const { container } = render(
        <AmountLabel
          amount={1999}
          currency="gbp"
          mode="standard"
          locale="en"
        />,
      )
      expect(container.textContent).toContain('£')
      expect(container.textContent).toContain('19.99')
    })

    it('renders SEK amount', () => {
      const { container } = render(
        <AmountLabel
          amount={19900}
          currency="sek"
          mode="standard"
          locale="en"
        />,
      )
      expect(container.textContent).toContain('199')
    })
  })

  describe('null/undefined interval', () => {
    it('renders no interval suffix when interval is null', () => {
      const { container } = render(
        <AmountLabel
          amount={999}
          currency="usd"
          interval={null}
          mode="standard"
          locale="en"
        />,
      )
      expect(container.textContent).toBe('$9.99')
    })

    it('renders no interval suffix when interval is undefined', () => {
      const { container } = render(
        <AmountLabel amount={999} currency="usd" mode="standard" locale="en" />,
      )
      expect(container.textContent).toBe('$9.99')
    })
  })
})
