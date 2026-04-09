import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createBaseCheckout } from '@polar-sh/checkout/test-utils'
import CheckoutEmbedLoaded from './CheckoutEmbedLoaded'

const mockPostMessage = vi.fn()
vi.mock('@polar-sh/checkout/embed', () => ({
  PolarEmbedCheckout: {
    postMessage: (...args: unknown[]) => mockPostMessage(...args),
  },
}))

describe('CheckoutEmbedLoaded', () => {
  it('sends loaded message when embed_origin is set', () => {
    const checkout = createBaseCheckout({
      embed_origin: 'https://example.com',
    })
    render(<CheckoutEmbedLoaded checkout={checkout} />)
    expect(mockPostMessage).toHaveBeenCalledWith(
      { event: 'loaded' },
      'https://example.com',
    )
  })

  it('does not send message when embed_origin is null', () => {
    mockPostMessage.mockClear()
    const checkout = createBaseCheckout({ embed_origin: null })
    render(<CheckoutEmbedLoaded checkout={checkout} />)
    expect(mockPostMessage).not.toHaveBeenCalled()
  })

  it('renders nothing', () => {
    const checkout = createBaseCheckout()
    const { container } = render(<CheckoutEmbedLoaded checkout={checkout} />)
    expect(container.innerHTML).toBe('')
  })
})
