import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createBaseCheckout } from '@polar-sh/checkout/test-utils'
import CheckoutEmbedLayout from './CheckoutEmbedLayout'

// CheckoutEmbedLoaded calls postMessage on mount — stub it to avoid jsdom errors
vi.mock('@polar-sh/checkout/embed', () => ({
  PolarEmbedCheckout: { postMessage: vi.fn() },
}))

describe('CheckoutEmbedLayout', () => {
  it('renders children and embed controls', () => {
    render(
      <CheckoutEmbedLayout checkout={createBaseCheckout()}>
        <div data-testid="child">content</div>
      </CheckoutEmbedLayout>,
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('applies dark class when theme is dark', () => {
    render(
      <CheckoutEmbedLayout checkout={createBaseCheckout()} theme="dark">
        <div>content</div>
      </CheckoutEmbedLayout>,
    )

    const layout = document.getElementById('polar-embed-layout')
    expect(layout?.className).toContain('dark')
  })

  it('applies light class when theme is light', () => {
    render(
      <CheckoutEmbedLayout checkout={createBaseCheckout()} theme="light">
        <div>content</div>
      </CheckoutEmbedLayout>,
    )

    const layout = document.getElementById('polar-embed-layout')
    expect(layout?.className).toContain('light')
  })
})
