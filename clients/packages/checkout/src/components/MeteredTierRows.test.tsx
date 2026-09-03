import { schemas } from '@polar-sh/client'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  createMeteredPrice,
  createMeteredTiersPrice,
} from '../test-utils/makeCheckout'
import MeteredTierRows from './MeteredTierRows'

const percentageDiscount = {
  id: 'disc_1',
  name: 'test',
  type: 'percentage',
  duration: 'once',
  code: null,
  basis_points: 5000,
} satisfies schemas['CheckoutPublic']['discount']

const graduated = (
  tiers: schemas['ProductPriceMeteredTiers']['tiers']['tiers'],
) => createMeteredTiersPrice({ tiers: { type: 'graduated', tiers } })

describe('MeteredTierRows', () => {
  it('orders tiers by bound and starts each one past the tier below', () => {
    const price = graduated([
      { bound: null, unit_amount: '100' },
      { bound: 5000, unit_amount: '450' },
      { bound: 1000, unit_amount: '900' },
    ])

    render(<MeteredTierRows price={price} locale="en" />)

    const rows = screen.getAllByTestId(/^detail-row-/)
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
      'detail-row-1–1,000',
      'detail-row-1,001–5,000',
      'detail-row-5,001+',
    ])
    expect(rows[0]).toHaveTextContent('$9.00')
    expect(rows[1]).toHaveTextContent('$4.50')
    expect(rows[2]).toHaveTextContent('$1.00')
  })

  it('renders nothing for a single unbounded tier', () => {
    const price = graduated([{ bound: null, unit_amount: '900' }])

    const { container } = render(<MeteredTierRows price={price} locale="en" />)

    expect(container.innerHTML).toBe('')
  })

  it('renders nothing for a flat metered price', () => {
    const { container } = render(
      <MeteredTierRows price={createMeteredPrice()} locale="en" />,
    )

    expect(container.innerHTML).toBe('')
  })

  it('explains that volume tiers reprice the whole quantity', () => {
    const price = createMeteredTiersPrice({
      tiers: {
        type: 'volume',
        tiers: [
          { bound: 1000, unit_amount: '900' },
          { bound: null, unit_amount: '450' },
        ],
      },
    })

    const { container } = render(<MeteredTierRows price={price} locale="en" />)

    expect(container.textContent).toContain(
      'All usage is billed at the rate for the range it falls in',
    )
  })

  it('leaves graduated tiers unexplained', () => {
    const price = graduated([
      { bound: 1000, unit_amount: '900' },
      { bound: null, unit_amount: '450' },
    ])

    const { container } = render(<MeteredTierRows price={price} locale="en" />)

    expect(container.textContent).not.toContain('All usage is billed')
  })

  it('discounts every tier rate', () => {
    const price = graduated([
      { bound: 1000, unit_amount: '900' },
      { bound: null, unit_amount: '300' },
    ])

    render(
      <MeteredTierRows
        price={price}
        locale="en"
        discount={percentageDiscount}
      />,
    )

    expect(screen.getByText('$9.00')).toHaveClass('line-through')
    expect(screen.getByText('$3.00')).toHaveClass('line-through')
    expect(screen.getByText('$4.50')).toBeInTheDocument()
    expect(screen.getByText('$1.50')).toBeInTheDocument()
  })
})
