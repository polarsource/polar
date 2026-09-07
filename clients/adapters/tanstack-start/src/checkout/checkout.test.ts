import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCheckoutCreate = vi.fn()

vi.mock('@polar-sh/sdk/2026-04', () => ({
  createPolarCore: vi.fn(() => ({})),
}))

vi.mock('@polar-sh/sdk/2026-04/services/checkouts', () => ({
  createCheckouts: () => mockCheckoutCreate,
}))

import { Checkout } from './checkout'

describe('Checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create checkout and redirect when products are provided', async () => {
    mockCheckoutCreate.mockResolvedValue({
      url: 'https://polar.sh/checkout/123',
    })

    const checkout = Checkout({ accessToken: 'test-token' })
    const request = new Request(
      'https://example.com/checkout?products=prod_123',
    )

    const response = await checkout({ request })

    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        products: ['prod_123'],
      }),
    )
    expect(response.status).toBe(302)
  })

  it.each([
    ['%2541', '%41'],
    ['%2500', '%00'],
    ['%7Bx%7D', '{x}'],
  ])('preserves URL escapes %s', async (encoded, decoded) => {
    mockCheckoutCreate.mockResolvedValue({
      url: 'https://polar.sh/checkout/123',
    })
    const checkout = Checkout({
      accessToken: 'test-token',
      successUrl: `https://example.com/success?data=${encoded}`,
      returnUrl: `https://example.com/return?data=${encoded}`,
      includeCheckoutId: true,
      theme: 'dark',
    })
    const response = await checkout({
      request: new Request('https://example.com/checkout?products=prod_123'),
    })

    const { success_url, return_url } = mockCheckoutCreate.mock.calls[0][0]
    expect(success_url).toBe(
      `https://example.com/success?data=${encoded}&checkout_id={CHECKOUT_ID}`,
    )
    const page = new URL(success_url.replaceAll('{CHECKOUT_ID}', 'chk_123'))
    expect(page.searchParams.get('data')).toBe(decoded)
    expect(page.searchParams.get('checkout_id')).toBe('chk_123')
    expect(return_url).toBe(`https://example.com/return?data=${encoded}`)
    expect(new URL(return_url).searchParams.get('data')).toBe(decoded)
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(
      'https://polar.sh/checkout/123?theme=dark',
    )
  })

  it('returns 400 when no products are provided', async () => {
    const checkout = Checkout({ accessToken: 'test-token' })
    const response = await checkout({
      request: new Request('https://example.com/checkout'),
    })
    expect(response.status).toBe(400)
  })

  it('should return a valid HTTP 500 with a JSON body when checkout creation fails', async () => {
    mockCheckoutCreate.mockRejectedValue(new Error('API Error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const checkout = Checkout({ accessToken: 'test-token' })
    const request = new Request(
      'https://example.com/checkout?products=prod_123',
    )

    const response = await checkout({ request })

    // Regression guard: the catch block must return a real HTTP 500 with a
    // JSON body, not `Response.error()` (which produces a status-0
    // "network error" sentinel that crashes the runtime).
    expect(response.status).toBe(500)
    expect(response.ok).toBe(false)
    expect(response.type).not.toBe('error')
    expect(response.headers.get('content-type')).toBe('application/json')

    const data = await response.json()
    expect(data).toEqual({ error: 'Internal server error' })

    // The original error is logged server-side; its message is not leaked.
    expect(consoleSpy).toHaveBeenCalledTimes(1)
    expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error))
    expect(data.error).not.toContain('API Error')

    consoleSpy.mockRestore()
  })
})
