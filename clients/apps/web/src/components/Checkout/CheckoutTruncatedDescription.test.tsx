import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CheckoutTruncatedDescription } from './CheckoutTruncatedDescription'

describe('CheckoutTruncatedDescription', () => {
  it('renders markdown description', () => {
    render(
      <CheckoutTruncatedDescription
        description="A **bold** product"
        productName="Test Product"
        readMoreLabel="Read more"
      />,
    )

    expect(screen.getByText('bold')).toBeInTheDocument()
  })
})
