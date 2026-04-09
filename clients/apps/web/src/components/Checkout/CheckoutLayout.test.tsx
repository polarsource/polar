import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createBaseCheckout } from '@polar-sh/checkout/test-utils'
import CheckoutLayout from './CheckoutLayout'

vi.mock('@/app/providers', () => ({
  PolarThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  ),
}))

vi.mock('./Embed/CheckoutEmbedLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="embed-layout">{children}</div>
  ),
}))

describe('CheckoutLayout', () => {
  it('renders embed layout when embed is true', () => {
    render(
      <CheckoutLayout checkout={createBaseCheckout()} embed={true}>
        <div data-testid="child">content</div>
      </CheckoutLayout>,
    )

    expect(screen.getByTestId('embed-layout')).toBeInTheDocument()
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.queryByTestId('theme-provider')).not.toBeInTheDocument()
  })

  it('renders full-page layout when embed is false', () => {
    render(
      <CheckoutLayout checkout={createBaseCheckout()} embed={false}>
        <div data-testid="child">content</div>
      </CheckoutLayout>,
    )

    expect(screen.getByTestId('theme-provider')).toBeInTheDocument()
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.queryByTestId('embed-layout')).not.toBeInTheDocument()
  })
})
