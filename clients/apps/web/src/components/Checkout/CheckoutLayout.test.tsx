import type { schemas } from '@polar-sh/client'
import { useDirection } from '@radix-ui/react-direction'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CheckoutLayout from './CheckoutLayout'

vi.mock('@/app/providers', () => ({
  PolarThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('./Embed/CheckoutEmbedClose', () => ({ default: () => null }))
vi.mock('./Embed/CheckoutEmbedLoaded', () => ({ default: () => null }))

const checkout = {
  id: 'co_123',
  embed_origin: null,
} as unknown as schemas['CheckoutPublic']

const DirectionProbe = () => <span data-testid="probe">{useDirection()}</span>

afterEach(() => {
  document.documentElement.removeAttribute('dir')
})

describe('CheckoutLayout', () => {
  it.each([false, true])(
    'provides RTL to Radix and the DOM (embed=%s)',
    (embed) => {
      render(
        <CheckoutLayout checkout={checkout} embed={embed} dir="rtl">
          <DirectionProbe />
        </CheckoutLayout>,
      )

      const probe = screen.getByTestId('probe')
      expect(probe).toHaveTextContent('rtl')
      const layout = probe.closest('[dir]')
      expect(layout).not.toBe(document.documentElement)
      expect(layout).toHaveAttribute('dir', 'rtl')
      expect(document.documentElement).toHaveAttribute('dir', 'rtl')
    },
  )

  it('defaults to LTR', () => {
    render(
      <CheckoutLayout checkout={checkout} embed={false}>
        <DirectionProbe />
      </CheckoutLayout>,
    )

    const probe = screen.getByTestId('probe')
    expect(probe).toHaveTextContent('ltr')
    const layout = probe.closest('[dir]')
    expect(layout).not.toBe(document.documentElement)
    expect(layout).toHaveAttribute('dir', 'ltr')
    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
  })

  it('restores the document direction on unmount', () => {
    document.documentElement.setAttribute('dir', 'ltr')
    const { unmount } = render(
      <CheckoutLayout checkout={checkout} embed={false} dir="rtl">
        <DirectionProbe />
      </CheckoutLayout>,
    )
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')

    unmount()

    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
  })
})
