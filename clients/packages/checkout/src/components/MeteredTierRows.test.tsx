import { schemas } from '@polar-sh/client'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createMeteredPrice } from '../test-utils/makeCheckout'
import MeteredTierRows from './MeteredTierRows'

type MeteredTiers = NonNullable<schemas['ProductPriceMeteredUnit']['tiers']>

const tieredPrice = (
  tier_type: MeteredTiers['tier_type'],
  tiers: MeteredTiers['tiers'],
  meter?: Partial<schemas['ProductPriceMeteredUnit']['meter']>,
) =>
  createMeteredPrice({
    unit_amount: null,
    tiers: { tier_type, tiers },
    ...(meter ? { meter: { ...createMeteredPrice().meter, ...meter } } : {}),
  })

const ladder: MeteredTiers['tiers'] = [
  { up_to: 1000, price_per_unit: '5' },
  { up_to: null, price_per_unit: '1' },
]

describe('MeteredTierRows', () => {
  it('lists every tier as an inclusive range starting one unit past the last', () => {
    const { container } = render(
      <MeteredTierRows price={tieredPrice('graduated', ladder)} locale="en" />,
    )

    expect(container.textContent).toContain('1–1,000')
    expect(container.textContent).toContain('1,001+')
    expect(container.textContent).toContain('$0.05')
    expect(container.textContent).toContain('$0.01')
  })

  it('leaves graduated unexplained, since a tier table already reads that way', () => {
    const { container } = render(
      <MeteredTierRows price={tieredPrice('graduated', ladder)} locale="en" />,
    )

    expect(container.textContent).not.toContain('All usage is billed')
    expect(container.textContent).not.toContain('own rate')
  })

  it('warns that volume reprices the whole usage', () => {
    const { container } = render(
      <MeteredTierRows price={tieredPrice('volume', ladder)} locale="en" />,
    )

    expect(container.textContent).toContain(
      'All usage is billed at the rate for the range it falls in',
    )
  })

  it('renders nothing for a flat price', () => {
    const { container } = render(
      <MeteredTierRows price={createMeteredPrice()} locale="en" />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when a single unbounded tier makes it a flat rate', () => {
    const price = tieredPrice('graduated', [
      { up_to: null, price_per_unit: '5' },
    ])

    const { container } = render(<MeteredTierRows price={price} locale="en" />)

    expect(container).toBeEmptyDOMElement()
  })

  it('walks a ladder of more than two tiers', () => {
    const price = tieredPrice('graduated', [
      { up_to: 100, price_per_unit: '10' },
      { up_to: 200, price_per_unit: '5' },
      { up_to: null, price_per_unit: '1' },
    ])

    const { container } = render(<MeteredTierRows price={price} locale="en" />)

    expect(container.textContent).toContain('1–100')
    expect(container.textContent).toContain('101–200')
    expect(container.textContent).toContain('201+')
  })

  it('sorts tiers that arrive out of order', () => {
    const price = tieredPrice('graduated', [
      { up_to: null, price_per_unit: '1' },
      { up_to: 1000, price_per_unit: '5' },
    ])

    const { container } = render(<MeteredTierRows price={price} locale="en" />)

    expect(container.textContent).toContain('1–1,000')
    expect(container.textContent).toContain('1,001+')
  })

  it('scales rates to the meter unit while leaving bounds in base units', () => {
    const price = tieredPrice(
      'graduated',
      [
        { up_to: 5_000_000, price_per_unit: '0.001' },
        { up_to: null, price_per_unit: '0.0005' },
      ],
      { unit: 'token' },
    )

    const { container } = render(<MeteredTierRows price={price} locale="en" />)

    expect(container.textContent).toContain('1–5,000,000')
    expect(container.textContent).toContain('$10.00')
    expect(container.textContent).toContain('/ 1M tokens')
  })

  it('discounts every tier rate, not just the first', () => {
    const discount = {
      id: 'disc_1',
      name: 'half',
      type: 'percentage',
      duration: 'once',
      code: 'halfoff',
      basis_points: 5000,
    } satisfies schemas['CheckoutPublic']['discount']

    const { container } = render(
      <MeteredTierRows
        price={tieredPrice('graduated', ladder)}
        locale="en"
        discount={discount}
      />,
    )

    expect(container.textContent).toContain('$0.025')
    expect(container.textContent).toContain('$0.005')
  })
})
