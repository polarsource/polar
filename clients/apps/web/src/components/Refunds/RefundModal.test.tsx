import { schemas } from '@polar-sh/client'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RefundModal } from './RefundModal'

vi.mock('@/hooks/queries', () => ({
  useCreateRefund: () => ({ isPending: false }),
}))

describe('RefundModal tax preview', () => {
  it.each([
    {
      scenario: 'all tax was already refunded',
      refundableAmount: 10000,
      refundableTax: 0,
      total: '$50',
      tax: '$0',
    },
    {
      scenario: 'remaining tax is below the proportional amount',
      refundableAmount: 10000,
      refundableTax: 500,
      total: '$55',
      tax: '$5',
    },
    {
      scenario: 'remaining tax covers the proportional amount',
      refundableAmount: 10000,
      refundableTax: 1500,
      total: '$60',
      tax: '$10',
    },
    {
      scenario: 'the full remaining refund includes all remaining tax',
      refundableAmount: 5000,
      refundableTax: 1500,
      total: '$65',
      tax: '$15',
    },
  ])('$scenario', ({ refundableAmount, refundableTax, total, tax }) => {
    const order = {
      id: 'order-1',
      currency: 'usd',
      net_amount: 10000,
      tax_amount: 2000,
      refundable_amount: refundableAmount,
      refundable_tax_amount: refundableTax,
      subscription_id: null,
    } as schemas['Order']

    render(<RefundModal order={order} hide={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '50' },
    })

    expect(screen.getByText(/Customer will be refunded/)).toHaveTextContent(
      `Customer will be refunded ${total} ($50 + ${tax} tax)`,
    )
  })
})
