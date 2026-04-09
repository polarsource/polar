import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createBaseCheckout } from '@polar-sh/checkout/test-utils'
import CheckoutEmbedClose from './CheckoutEmbedClose'

const mockPostMessage = vi.fn()
vi.mock('@polar-sh/checkout/embed', () => ({
  PolarEmbedCheckout: {
    postMessage: (...args: unknown[]) => mockPostMessage(...args),
  },
}))

describe('CheckoutEmbedClose', () => {
  it('renders a close button', () => {
    render(
      <CheckoutEmbedClose
        checkout={createBaseCheckout({ embed_origin: 'https://example.com' })}
      />,
    )
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('sends close message when clicked with embed_origin', () => {
    render(
      <CheckoutEmbedClose
        checkout={createBaseCheckout({ embed_origin: 'https://example.com' })}
      />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(mockPostMessage).toHaveBeenCalledWith(
      { event: 'close' },
      'https://example.com',
    )
  })

  it('does not send message when embed_origin is null', () => {
    mockPostMessage.mockClear()
    render(
      <CheckoutEmbedClose
        checkout={createBaseCheckout({ embed_origin: null })}
      />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(mockPostMessage).not.toHaveBeenCalled()
  })
})
