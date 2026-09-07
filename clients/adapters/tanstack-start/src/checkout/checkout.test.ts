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
