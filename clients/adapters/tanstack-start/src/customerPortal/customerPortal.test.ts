import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCustomerSessionCreate = vi.fn()

vi.mock('@polar-sh/sdk/2026-04', () => ({
  createPolarCore: vi.fn(() => ({})),
}))

vi.mock('@polar-sh/sdk/2026-04/services/customer_sessions', () => ({
  createCustomerSessions: () => mockCustomerSessionCreate,
}))

import { CustomerPortal } from './customerPortal'

describe('CustomerPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create customer session and redirect when customerId is valid', async () => {
    const getCustomerId = vi.fn().mockResolvedValue('cust_123')
    mockCustomerSessionCreate.mockResolvedValue({
      customer_portal_url: 'https://polar.sh/portal/session_123',
    })

    const portal = CustomerPortal({
      accessToken: 'test-token',
      environment: 'production',
      getCustomerId,
    })

    const request = new Request('https://example.com/portal')
    const response = await portal({ request })

    expect(mockCustomerSessionCreate).toHaveBeenCalledWith({
      customer_id: 'cust_123',
      return_url: undefined,
    })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(
      'https://polar.sh/portal/session_123',
    )
  })

  it('should return a valid HTTP 500 with a JSON body when customer session creation fails', async () => {
    const getCustomerId = vi.fn().mockResolvedValue('cust_123')
    mockCustomerSessionCreate.mockRejectedValue(new Error('API Error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const portal = CustomerPortal({
      accessToken: 'test-token',
      environment: 'production',
      getCustomerId,
    })

    const request = new Request('https://example.com/portal')
    const response = await portal({ request })

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
