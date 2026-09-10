import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCustomerSessionCreate = vi.fn()

vi.mock('@polar-sh/sdk/2026-04', () => ({
  createPolarCore: vi.fn(() => ({})),
}))

vi.mock('@polar-sh/sdk/2026-04/services/customer_sessions', () => ({
  createCustomerSessions: () => mockCustomerSessionCreate,
}))

import { CustomerPortal } from './customerPortal'

/**
 * Reproduces the `decodeURI` over-decoding regression in the customer-portal
 * adapter's `return_url` handling.
 *
 * The adapter previously wrapped the merchant-configured `returnUrl` in
 * `decodeURI(new URL(returnUrl).toString())`. `decodeURI` strips one encoding
 * layer from the entire URL, so any `%25`-prefixed literal the merchant
 * statically encoded (a literal `%` the return page should receive verbatim)
 * lost a layer and arrived as the decoded character. `new URL(...).toString()`
 * already produces a canonical, percent-encoded URL; `decodeURI` can only leave
 * it unchanged or corrupt it.
 *
 * Unlike checkout `success_url`, the customer-portal `return_url` has no
 * `{CHECKOUT_ID}` placeholder, so the wire value is stored verbatim by the
 * server (`HttpUrl` -> `str(return_url)` onto a plain `String` column) and read
 * back as-is at the return page — `new URL(return_url)` simulates that read.
 *
 * Run: pnpm --filter @polar-sh/tanstack-start exec vitest run src/customerPortal/customerPortal_decodeuri_repro.test.ts
 */

describe('Customer Portal returnUrl percent-escape preservation (decodeURI regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCustomerSessionCreate.mockResolvedValue({
      customer_portal_url: 'https://polar.sh/portal/session_123',
    })
  })

  const buildRequest = () => new Request('https://example.com/portal')

  const getCallArg = () => mockCustomerSessionCreate.mock.calls[0][0]

  it.each([
    ['%2541', '%41'],
    ['%2500', '%00'],
    ['50%25off', '50%off'],
  ])(
    'preserves a %25-prefixed literal so the return page reads %s (not the decoded char)',
    async (encoded, decoded) => {
      const portal = CustomerPortal({
        accessToken: 'test-token',
        environment: 'production',
        getCustomerId: vi.fn().mockResolvedValue('cust_123'),
        returnUrl: `https://example.com/account?data=${encoded}`,
      })

      await portal({ request: buildRequest() })

      const wire = getCallArg().return_url as string
      // The %2541 the merchant configured must survive intact on the wire.
      expect(wire).toBe(`https://example.com/account?data=${encoded}`)

      // A return page that reads the query via a percent-decoding reader
      // (URLSearchParams.get) must receive the decoded literal, not the
      // character the merchant encoded to escape.
      expect(new URL(wire).searchParams.get('data')).toBe(decoded)
    },
  )

  it('does not over-decode reserved-character escapes (%7Bx%7D stays %7Bx%7D on the wire)', async () => {
    const portal = CustomerPortal({
      accessToken: 'test-token',
      environment: 'production',
      getCustomerId: vi.fn().mockResolvedValue('cust_123'),
      returnUrl: 'https://example.com/account?data=%7Bx%7D',
    })

    await portal({ request: buildRequest() })

    const wire = getCallArg().return_url as string
    expect(wire).toBe('https://example.com/account?data=%7Bx%7D')
    expect(new URL(wire).searchParams.get('data')).toBe('{x}')
  })

  it('preserves a URL-as-a-value with reserved chars (https%3A%2F%2Fexample.com)', async () => {
    const portal = CustomerPortal({
      accessToken: 'test-token',
      environment: 'production',
      getCustomerId: vi.fn().mockResolvedValue('cust_123'),
      returnUrl: 'https://example.com/account?url=https%3A%2F%2Fexample.com',
    })

    await portal({ request: buildRequest() })

    const wire = getCallArg().return_url as string
    expect(wire).toBe(
      'https://example.com/account?url=https%3A%2F%2Fexample.com',
    )
    expect(new URL(wire).searchParams.get('url')).toBe('https://example.com')
  })

  it('preserves a percent-encoded space in the path (my%20path)', async () => {
    const portal = CustomerPortal({
      accessToken: 'test-token',
      environment: 'production',
      getCustomerId: vi.fn().mockResolvedValue('cust_123'),
      returnUrl: 'https://example.com/my%20path/account',
    })

    await portal({ request: buildRequest() })

    const wire = getCallArg().return_url as string
    expect(wire).toBe('https://example.com/my%20path/account')
    expect(wire).not.toContain('my path')
    expect(new URL(wire).pathname).toBe('/my%20path/account')
  })

  it('passes return_url as undefined when no returnUrl is configured', async () => {
    const portal = CustomerPortal({
      accessToken: 'test-token',
      environment: 'production',
      getCustomerId: vi.fn().mockResolvedValue('cust_123'),
    })

    await portal({ request: buildRequest() })

    expect(mockCustomerSessionCreate).toHaveBeenCalledWith({
      customer_id: 'cust_123',
      return_url: undefined,
    })
    expect(getCallArg().return_url).toBeUndefined()
  })
})
