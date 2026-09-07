import type { ProductCheckoutPublic } from '@polar-sh/checkout/guards'
import type { schemas } from '@polar-sh/client'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CheckoutCollapsibleOrderSummary } from './CheckoutCollapsibleOrderSummary'

afterEach(cleanup)

vi.mock('./CheckoutOrderSummary', () => ({
  CheckoutOrderSummary: () => <div data-testid="order-summary" />,
}))

vi.mock('@polar-sh/checkout/components', () => ({
  CheckoutHeroPrice: ({ compact }: { compact?: boolean }) => (
    <span>{compact ? 'compact price' : 'hero price'}</span>
  ),
}))

const createPrice = (
  overrides: Record<string, unknown> = {},
): schemas['ProductPrice'] =>
  ({
    id: 'price_1',
    amount_type: 'fixed',
    type: 'recurring',
    price_amount: 999,
    price_currency: 'usd',
    ...overrides,
  }) as unknown as schemas['ProductPrice']

const createCheckout = (
  overrides: Partial<ProductCheckoutPublic> = {},
): ProductCheckoutPublic => {
  const price = createPrice()
  return {
    currency: 'usd',
    product_id: 'prod_1',
    product: { id: 'prod_1', name: 'Pro', medias: [] },
    product_price: price,
    products: [{ id: 'prod_1' }],
    prices: { prod_1: [price] },
    ...overrides,
  } as unknown as ProductCheckoutPublic
}

const renderSummary = (checkout = createCheckout()) =>
  render(
    <CheckoutCollapsibleOrderSummary
      checkout={checkout}
      update={vi.fn()}
      themePreset={{} as never}
      locale="en"
      trialDueTodayExperiment={false}
    />,
  )

describe('CheckoutCollapsibleOrderSummary', () => {
  it('starts collapsed with the compact price in the bar', () => {
    renderSummary()

    const toggle = screen.getByRole('button', { name: /Order summary/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.textContent).toContain('compact price')

    const summary = document.getElementById(
      toggle.getAttribute('aria-controls')!,
    )!
    expect(summary.className).toContain('hidden')
    expect(
      summary.querySelector('[data-testid="order-summary"]'),
    ).not.toBeNull()
  })

  it('expands and collapses on click', () => {
    renderSummary()

    const toggle = screen.getByRole('button', { name: /Order summary/ })
    const summary = document.getElementById(
      toggle.getAttribute('aria-controls')!,
    )!

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(summary.className).not.toContain('hidden')

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(summary.className).toContain('hidden')
  })
})
