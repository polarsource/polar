import { schemas } from '@polar-sh/client'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  createCheckout,
  createFixedPrice,
  createMeteredPrice,
  createMeteredTiersPrice,
} from '../test-utils/makeCheckout'
import MeteredChargesDetails from './MeteredChargesDetails'

function createMeterCreditBenefit(
  meterId: string,
  units: number,
): schemas['CheckoutProduct']['benefits'][number] {
  return {
    id: `benefit_${meterId}_${units}`,
    created_at: new Date().toISOString(),
    modified_at: null,
    type: 'meter_credit',
    description: `${units} units included`,
    selectable: true,
    deletable: true,
    is_deleted: false,
    organization_id: 'org_1',
    properties: {
      units,
      meter_id: meterId,
    },
  }
}

function createMeteredCheckout({
  benefits = [],
}: {
  benefits?: schemas['CheckoutProduct']['benefits']
} = {}) {
  const base = createCheckout()
  const meteredPrice = createMeteredPrice({
    id: 'price_metered_1',
    unit_amount: '900',
    meter: {
      id: 'meter_1',
      name: 'API Calls',
      unit: 'scalar' as const,
      custom_label: null,
      custom_multiplier: null,
    },
  })
  return createCheckout({
    prices: {
      prod_1: [base.product_price, meteredPrice],
    },
    product: {
      ...base.product,
      benefits,
    },
  })
}

describe('MeteredChargesDetails', () => {
  it('renders nothing without metered prices', () => {
    const checkout = createCheckout({
      prices: { prod_1: [createFixedPrice()] },
    })

    const { container } = render(
      <MeteredChargesDetails checkout={checkout} locale="en" />,
    )

    expect(container.innerHTML).toBe('')
  })

  it('renders a tiered metered price at its starting rate', () => {
    const base = createCheckout()
    const checkout = createCheckout({
      prices: { prod_1: [base.product_price, createMeteredTiersPrice()] },
    })

    render(<MeteredChargesDetails checkout={checkout} locale="en" />)

    fireEvent.click(
      screen.getByRole('button', {
        name: /additional metered charges may apply/i,
      }),
    )

    expect(screen.getByTestId('detail-row-API Calls')).toHaveTextContent(
      '$9.00',
    )
  })

  it('is collapsed by default', () => {
    render(
      <MeteredChargesDetails checkout={createMeteredCheckout()} locale="en" />,
    )

    expect(
      screen.getByRole('button', {
        name: /additional metered charges may apply/i,
      }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('detail-row-API Calls')).not.toBeInTheDocument()
  })

  it('expands and collapses on click', () => {
    render(
      <MeteredChargesDetails checkout={createMeteredCheckout()} locale="en" />,
    )
    const toggle = screen.getByRole('button', {
      name: /additional metered charges may apply/i,
    })

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const row = screen.getByTestId('detail-row-API Calls')
    expect(row).toHaveTextContent('$9.00')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('detail-row-API Calls')).not.toBeInTheDocument()
  })

  it('shows included units from meter credit benefits before the rate', () => {
    render(
      <MeteredChargesDetails
        checkout={createMeteredCheckout({
          benefits: [createMeterCreditBenefit('meter_1', 10000)],
        })}
        locale="en"
      />,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: /additional metered charges may apply/i,
      }),
    )

    expect(screen.getByTestId('detail-row-API Calls')).toHaveTextContent(
      '10,000 units included',
    )
  })

  it('labels included units with the meter unit noun', () => {
    const base = createCheckout()
    const meteredPrice = createMeteredPrice({
      id: 'price_metered_1',
      unit_amount: '0.001',
      meter: {
        id: 'meter_1',
        name: 'AI Tokens',
        unit: 'token' as const,
        custom_label: null,
        custom_multiplier: null,
      },
    })
    const checkout = createCheckout({
      prices: {
        prod_1: [base.product_price, meteredPrice],
      },
      product: {
        ...base.product,
        benefits: [createMeterCreditBenefit('meter_1', 10_000_000)],
      },
    })

    render(<MeteredChargesDetails checkout={checkout} locale="en" />)

    fireEvent.click(
      screen.getByRole('button', {
        name: /additional metered charges may apply/i,
      }),
    )

    const row = screen.getByTestId('detail-row-AI Tokens')
    expect(row).toHaveTextContent('10,000,000 tokens included')
    expect(row).toHaveTextContent('/ 1M tokens')
  })

  it('sums units across multiple credit benefits on the same meter', () => {
    render(
      <MeteredChargesDetails
        checkout={createMeteredCheckout({
          benefits: [
            createMeterCreditBenefit('meter_1', 10000),
            createMeterCreditBenefit('meter_1', 5000),
          ],
        })}
        locale="en"
      />,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: /additional metered charges may apply/i,
      }),
    )

    expect(screen.getByTestId('detail-row-API Calls')).toHaveTextContent(
      '15,000 units included',
    )
  })

  it('ignores credit benefits for other meters', () => {
    render(
      <MeteredChargesDetails
        checkout={createMeteredCheckout({
          benefits: [createMeterCreditBenefit('meter_other', 10000)],
        })}
        locale="en"
      />,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: /additional metered charges may apply/i,
      }),
    )

    const row = screen.getByTestId('detail-row-API Calls')
    expect(row).not.toHaveTextContent('included')
    expect(row).toHaveTextContent('$9.00')
  })
})
