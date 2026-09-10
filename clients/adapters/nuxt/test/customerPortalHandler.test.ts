import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// `vi.hoisted` makes the mock fns available to the `vi.mock` factories, which
// vitest hoists above ordinary top-level `const` declarations (so a plain
// `const` would hit a TDZ ReferenceError when the factory runs at import time).
const { mockCustomerSessionCreate, mockSendRedirect } = vi.hoisted(() => ({
  mockCustomerSessionCreate: vi.fn(),
  mockSendRedirect: vi.fn(),
}))

vi.mock('@polar-sh/sdk/2026-04', () => ({
  createPolarCore: vi.fn(() => ({})),
}))

vi.mock('@polar-sh/sdk/2026-04/services/customer_sessions', () => ({
  createCustomerSessions: () => mockCustomerSessionCreate,
}))

vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3')
  return {
    ...actual,
    // `sendRedirect` writes response headers/status onto event.node.res,
    // which a unit-test fixture never has. Stub it so the handler's redirect
    // can be observed without a real Node response.
    sendRedirect: mockSendRedirect,
  }
})

import { createEvent } from 'h3'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { CustomerPortal } from '../src/runtime/server/customerPortalHandler'

function makeEvent(url: string) {
  const req = { method: 'GET', url, headers: {} } as unknown as IncomingMessage
  const res = {} as unknown as ServerResponse
  return createEvent(req, res)
}

describe('CustomerPortal', () => {
  beforeAll(() => {
    mockSendRedirect.mockResolvedValue(undefined)
  })

  beforeEach(() => {
    mockCustomerSessionCreate.mockClear()
    mockSendRedirect.mockClear()
    mockCustomerSessionCreate.mockResolvedValue({
      customer_portal_url: 'https://polar.sh/portal/session_123',
    })
  })

  describe('returnUrl percent-escape preservation', () => {
    it.each([
      ['%2541', '%41'],
      ['%2500', '%00'],
      ['%7Bx%7D', '{x}'],
    ])('preserves URL escapes %s on return_url', async (encoded, decoded) => {
      const portal = CustomerPortal({
        accessToken: 'test-token',
        getCustomerId: vi.fn().mockResolvedValue('cust_123'),
        returnUrl: `https://example.com/return?data=${encoded}`,
      })
      await portal(makeEvent('/api/customer-portal'))

      expect(mockCustomerSessionCreate).toHaveBeenCalledWith({
        customer_id: 'cust_123',
        return_url: `https://example.com/return?data=${encoded}`,
      })
      const wire = mockCustomerSessionCreate.mock.calls[0][0].return_url
      expect(new URL(wire).searchParams.get('data')).toBe(decoded)
    })
  })

  it('redirects to the customer portal URL returned by the SDK', async () => {
    const portal = CustomerPortal({
      accessToken: 'test-token',
      getCustomerId: vi.fn().mockResolvedValue('cust_123'),
    })
    const event = makeEvent('/api/customer-portal')
    await portal(event)

    expect(mockSendRedirect).toHaveBeenCalledTimes(1)
    const [redirectedEvent, location] = mockSendRedirect.mock.calls[0]
    expect(redirectedEvent).toBe(event)
    expect(location).toBe('https://polar.sh/portal/session_123')
  })

  it('returns 400 when customerId is not defined', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const portal = CustomerPortal({
      accessToken: 'test-token',
      getCustomerId: vi.fn().mockResolvedValue(''),
    })

    await expect(portal(makeEvent('/api/customer-portal'))).rejects.toThrow(
      'customerId not defined',
    )
    expect(mockCustomerSessionCreate).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
