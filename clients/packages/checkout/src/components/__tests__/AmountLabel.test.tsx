import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AmountLabel from '../AmountLabel'

describe('AmountLabel Component', () => {
  it('renders amount with default currency (USD)', () => {
    render(<AmountLabel amount={1000} currency="USD" />)
    expect(screen.getByText('$1,000.00')).toBeInTheDocument()
  })

  it('renders amount with specified currency', () => {
    render(<AmountLabel amount={1000} currency="EUR" />)
    expect(screen.getByText('€1,000.00')).toBeInTheDocument()
  })

  it('renders zero amount correctly', () => {
    render(<AmountLabel amount={0} currency="USD" />)
    expect(screen.getByText('$0.00')).toBeInTheDocument()
  })

  it('renders negative amounts with minus sign', () => {
    render(<AmountLabel amount={-1000} currency="USD" />)
    expect(screen.getByText('-$1,000.00')).toBeInTheDocument()
  })

  it('handles fractional amounts correctly', () => {
    render(<AmountLabel amount={1099} currency="USD" />)
    expect(screen.getByText('$1,099.00')).toBeInTheDocument()
  })
})
