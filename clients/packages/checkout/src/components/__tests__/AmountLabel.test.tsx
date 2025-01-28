import { render, screen } from '@testing-library/react'
import AmountLabel from '../AmountLabel'

describe('AmountLabel Component', () => {
  it('renders amount with default currency (USD)', () => {
    render(<AmountLabel amount={1000} currency="USD" />)
    expect(screen.getByText('$10')).toBeInTheDocument()
  })

  it('renders zero amount correctly', () => {
    render(<AmountLabel amount={0} currency="USD" />)
    expect(screen.getByText('$0')).toBeInTheDocument()
  })

  it('renders negative amounts with minus sign', () => {
    render(<AmountLabel amount={-1000} currency="USD" />)
    expect(screen.getByText('-$10')).toBeInTheDocument()
  })

  it('handles fractional amounts correctly', () => {
    render(<AmountLabel amount={1099} currency="USD" />)
    expect(screen.getByText('$10.99')).toBeInTheDocument()
  })
})
